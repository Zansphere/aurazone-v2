import jwt from "jsonwebtoken";
import { type APIRequestContext, type APIResponse } from "@playwright/test";
import { envConfig } from "../config/env.config.js";

export type UserRole = "PUBLIC" | "CUSTOMER" | "STORE_MANAGER" | "SUPER_ADMIN";

export interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  data?: any;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  role?: UserRole;
  token?: string;
}

export class ApiClient {
  private requestContext: APIRequestContext;
  private defaultRole: UserRole;
  private cachedTokens = new Map<UserRole, string>();

  constructor(requestContext: APIRequestContext, defaultRole: UserRole = "PUBLIC") {
    this.requestContext = requestContext;
    this.defaultRole = defaultRole;
  }

  /**
   * Retrieves a real-time server-issued JWT token via live /auth/login.
   * Falls back to a local signed JWT if the API is offline.
   */
  public async getRealToken(role: UserRole): Promise<string> {
    if (role === "PUBLIC") return "";
    if (this.cachedTokens.has(role)) {
      return this.cachedTokens.get(role)!;
    }

    const creds =
      role === "SUPER_ADMIN"
        ? envConfig.users.superAdmin
        : role === "STORE_MANAGER"
        ? envConfig.users.storeManager
        : envConfig.users.customer;

    try {
      const base = envConfig.apiUrl.replace(/\/api\/v1$/, "");
      const loginUrl = `${base}/api/v1/auth/login`;
      const res = await this.requestContext.post(loginUrl, {
        data: { email: creds.email, password: creds.password },
        headers: { "Content-Type": "application/json" },
      });

      if (res.status() === 200) {
        const json = await res.json();
        const serverToken = json?.data?.accessToken;
        if (serverToken) {
          this.cachedTokens.set(role, serverToken);
          return serverToken;
        }
      }
    } catch {
      // Live server unreachable, continue to fallback
    }

    return this.getFallbackToken(role);
  }

  /**
   * Generates a signed fallback JWT token for offline tests.
   */
  public getFallbackToken(role: UserRole): string {
    if (role === "PUBLIC") return "";
    let payload: { userId: string; email: string; role: string };
    if (role === "SUPER_ADMIN") {
      payload = {
        userId: "543b9c2f-3aa9-437a-991a-e02820687c91",
        email: envConfig.users.superAdmin.email,
        role: "SUPER_ADMIN",
      };
    } else if (role === "STORE_MANAGER") {
      payload = {
        userId: "6a2a4bc7-8e11-4f64-b628-30fdbc360dd0",
        email: envConfig.users.storeManager.email,
        role: "STORE_MANAGER",
      };
    } else {
      payload = {
        userId: "e981a2ac-7b3d-42ab-ae46-69b111929446",
        email: envConfig.users.customer.email,
        role: "CUSTOMER",
      };
    }

    const token = jwt.sign(payload, envConfig.jwtSecret, { expiresIn: "1h" });
    this.cachedTokens.set(role, token);
    return token;
  }

  public getToken(role: UserRole): string {
    return this.cachedTokens.get(role) || this.getFallbackToken(role);
  }

  /**
   * Dispatches an HTTP request with automatic URL normalization, real-time role headers, and error handling.
   */
  public async send(opts: RequestOptions): Promise<APIResponse> {
    const role = opts.role || this.defaultRole;
    const token = opts.token !== undefined ? opts.token : await this.getRealToken(role);

    // Normalize endpoint (ensure it targets /api/v1 properly)
    let url = opts.endpoint;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const cleanPath = url.startsWith("/api/v1") ? url : `/api/v1${url.startsWith("/") ? "" : "/"}${url}`;
      // Clean base url to avoid duplicate /api/v1
      const base = envConfig.apiUrl.replace(/\/api\/v1$/, "");
      url = `${base}${cleanPath}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Resolve data strings into structured payloads
    let data = opts.data;
    if (typeof data === "string" && data.trim()) {
      const d = data.toLowerCase();
      if (d.includes("super admin credentials")) {
        data = { email: envConfig.users.superAdmin.email, password: envConfig.users.superAdmin.password };
      } else if (d.includes("store manager credentials")) {
        data = { email: envConfig.users.storeManager.email, password: envConfig.users.storeManager.password };
      } else if (d.includes("customer credentials")) {
        data = { email: envConfig.users.customer.email, password: envConfig.users.customer.password };
      } else if (d.includes("invalid") && (d.includes("credential") || d.includes("sm") || d.includes("admin") || d.includes("password"))) {
        data = { email: "wrong@aurazone.com", password: "InvalidPassword123!" };
      } else if (d.includes("empty password")) {
        data = { email: "admin@aurazone.com", password: "" };
      } else if (d.includes("empty body")) {
        data = {};
      } else if (d.includes("duplicate email")) {
        data = { email: envConfig.users.superAdmin.email, password: "NewPassword123!", role: "STORE_MANAGER", fullName: "Duplicate User" };
      } else if (d.includes("create store manager")) {
        data = { email: `manager_${Date.now()}@aurazone.com`, password: "Manager@123", role: "STORE_MANAGER", fullName: "New Manager" };
      } else if (d.includes("create another super admin")) {
        data = { email: `admin_${Date.now()}@aurazone.com`, password: "Admin@123", role: "SUPER_ADMIN", fullName: "New Super Admin" };
      } else if (d.includes("valid product") || d.includes("valid data")) {
        data = {
          name: `Test Product ${Date.now()}`,
          description: "Automated test product description",
          price: 199.99,
          stock: 50,
          categoryId: "test-category",
        };
      } else {
        try {
          data = JSON.parse(data);
        } catch {
          // Keep as string if not JSON
        }
      }
    }

    // Resolve URL placeholders
    if (url.includes("{otherId}")) {
      url = url.replace("{otherId}", "00000000-0000-0000-0000-000000000002");
    }
    if (url.includes("{unknownId}")) {
      url = url.replace("{unknownId}", "00000000-0000-0000-0000-000000000000");
    }
    if (url.includes("{itemId}")) {
      url = url.replace("{itemId}", "00000000-0000-0000-0000-000000000000");
    }
    if (url.includes("{ownId}")) {
      url = url.replace("{ownId}", "543b9c2f-3aa9-437a-991a-e02820687c91");
    }

    const requestOptions: any = {
      headers,
      params: opts.params,
    };

    if (data && opts.method !== "GET") {
      requestOptions.data = data;
    }

    switch (opts.method) {
      case "GET":
        return this.requestContext.get(url, requestOptions);
      case "POST":
        return this.requestContext.post(url, requestOptions);
      case "PUT":
        return this.requestContext.put(url, requestOptions);
      case "PATCH":
        return this.requestContext.patch(url, requestOptions);
      case "DELETE":
        return this.requestContext.delete(url, requestOptions);
      default:
        throw new Error(`Unsupported HTTP method: ${opts.method}`);
    }
  }

  public get(endpoint: string, params?: Record<string, any>) {
    return this.send({ method: "GET", endpoint, params });
  }

  public post(endpoint: string, data?: any) {
    return this.send({ method: "POST", endpoint, data });
  }

  public put(endpoint: string, data?: any) {
    return this.send({ method: "PUT", endpoint, data });
  }

  public patch(endpoint: string, data?: any) {
    return this.send({ method: "PATCH", endpoint, data });
  }

  public delete(endpoint: string, data?: any) {
    return this.send({ method: "DELETE", endpoint, data });
  }
}

