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
   * Generates or retrieves a valid JWT token for the specified role.
   */
  public getToken(role: UserRole): string {
    if (role === "PUBLIC") return "";
    if (this.cachedTokens.has(role)) {
      return this.cachedTokens.get(role)!;
    }

    let payload: { userId: string; email: string; role: string };
    if (role === "SUPER_ADMIN") {
      payload = {
        userId: "admin-test-id",
        email: envConfig.users.superAdmin.email,
        role: "SUPER_ADMIN",
      };
    } else if (role === "STORE_MANAGER") {
      payload = {
        userId: "manager-test-id",
        email: envConfig.users.storeManager.email,
        role: "STORE_MANAGER",
      };
    } else {
      payload = {
        userId: "customer-test-id",
        email: envConfig.users.customer.email,
        role: "CUSTOMER",
      };
    }

    const token = jwt.sign(payload, envConfig.jwtSecret, { expiresIn: "1h" });
    this.cachedTokens.set(role, token);
    return token;
  }

  /**
   * Dispatches an HTTP request with automatic URL normalization, role headers, and error handling.
   */
  public async send(opts: RequestOptions): Promise<APIResponse> {
    const role = opts.role || this.defaultRole;
    const token = opts.token || this.getToken(role);

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

    let data = opts.data;
    if (typeof data === "string" && data.trim()) {
      try {
        data = JSON.parse(data);
      } catch {}
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
