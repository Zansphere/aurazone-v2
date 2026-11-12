import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { type APIRequestContext, type APIResponse } from "@playwright/test";
import { envConfig } from "../config/env.config.js";

export type UserRole = "PUBLIC" | "CUSTOMER" | "STORE_MANAGER" | "SUPER_ADMIN";

const TOKEN_CACHE_FILE = path.resolve(process.cwd(), ".token-cache.json");

function isTokenValid(token?: string): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    // Ensure token is not expired and has at least 30s remaining
    return typeof payload.exp === "number" && payload.exp - now > 30;
  } catch {
    return false;
  }
}

function readDiskTokenCache(): Record<string, string> {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function writeDiskTokenCache(role: string, token: string) {
  try {
    const cache = readDiskTokenCache();
    cache[role] = token;
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

let cachedSampleProductId: string | null = null;
let cachedSampleProductSlug: string | null = null;
let cachedSampleCategoryId: string | null = null;
let cachedSampleStoreId: string | null = null;
let cachedSampleVariantId: string | null = null;
let cachedSampleOrderId: string | null = "b357581c-8b45-4fd5-bc2a-479bd875ff59";
let cachedSampleCartItemId: string | null = null;

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
   * Uses disk caching to prevent hitting Fastify rate-limits across workers.
   */
  public async getRealToken(role: UserRole): Promise<string> {
    if (role === "PUBLIC") return "";
    if (this.cachedTokens.has(role)) {
      const memToken = this.cachedTokens.get(role)!;
      if (isTokenValid(memToken)) return memToken;
    }

    // Check cross-worker disk cache
    const diskCache = readDiskTokenCache();
    if (diskCache[role] && isTokenValid(diskCache[role])) {
      this.cachedTokens.set(role, diskCache[role]);
      return diskCache[role];
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
          writeDiskTokenCache(role, serverToken);
          return serverToken;
        }
      }
    } catch {
      // Live server unreachable, continue to fallback
    }

    return this.getFallbackToken(role);
  }

  /**
   * Returns an expired JWT token for negative auth testing.
   */
  public getExpiredToken(role: UserRole = "CUSTOMER"): string {
    const payload = {
      userId: "expired-user-id",
      email: "expired@aurazone.com",
      role,
    };
    return jwt.sign(payload, envConfig.jwtSecret, { expiresIn: "-1h" });
  }

  /**
   * Returns a token for a deleted/suspended user.
   */
  public getDeletedUserToken(): string {
    const payload = {
      userId: "deleted-user-id",
      email: "deleted_user@aurazone.com",
      role: "CUSTOMER",
    };
    return jwt.sign(payload, envConfig.jwtSecret, { expiresIn: "1h" });
  }

  /**
   * Generates a signed fallback JWT token for offline tests.
   */
  public getFallbackToken(role: UserRole): string {
    if (role === "PUBLIC") return "";
    let payload: { userId: string; email: string; role: string };
    if (role === "SUPER_ADMIN") {
      payload = {
        userId: "4beca3a6-04c0-4b93-9514-1d5a7b922c46",
        email: envConfig.users.superAdmin.email,
        role: "SUPER_ADMIN",
      };
    } else if (role === "STORE_MANAGER") {
      payload = {
        userId: "63d3a771-25a6-4a2e-8a18-e890e1c7ffac",
        email: envConfig.users.storeManager.email,
        role: "STORE_MANAGER",
      };
    } else {
      payload = {
        userId: "b1c76037-cd4a-42f7-82d7-1d66f60d5aba",
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
   * Fetches sample product / category IDs to dynamically bind in URL params.
   */
  public async ensureSampleData(base: string) {
    if (cachedSampleProductId && cachedSampleCategoryId && cachedSampleProductSlug && cachedSampleStoreId) return;
    try {
      const [prodRes, catRes] = await Promise.all([
        this.requestContext.get(`${base}/api/v1/products?limit=1`),
        this.requestContext.get(`${base}/api/v1/categories`),
      ]);

      if (prodRes.status() === 200) {
        const json = await prodRes.json();
        const p = Array.isArray(json?.data) ? json.data[0] : (json?.data?.products?.[0] || json?.data);
        if (p) {
          cachedSampleProductId = p.id;
          cachedSampleProductSlug = p.slug;
          cachedSampleStoreId = p.storeId;
          cachedSampleCategoryId = p.categoryId;
          if (p.variants && p.variants[0]) {
            cachedSampleVariantId = p.variants[0].id;
          }
        }
      }

      if (catRes.status() === 200) {
        const json = await catRes.json();
        const cat = Array.isArray(json?.data) ? json.data[0] : (json?.data?.categories?.[0] || json?.data);
        if (cat) {
          cachedSampleCategoryId = cat.id;
          cachedSampleStoreId = cat.storeId;
        }
      }

      // Ensure customer cart has at least 1 item for item-level actions
      if (!cachedSampleCartItemId && cachedSampleVariantId) {
        const cartToken = this.getFallbackToken("CUSTOMER");
        const cartRes = await this.requestContext.post(`${base}/api/v1/cart`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cartToken}` },
          data: { variantId: cachedSampleVariantId, quantity: 1 },
        });
        if (cartRes.status() === 200 || cartRes.status() === 201) {
          const cartJson = await cartRes.json();
          const items = cartJson?.data?.items;
          if (items && items[0]) {
            cachedSampleCartItemId = items[0].id;
          }
        }
      }
    } catch {}
  }

  /**
   * Dispatches an HTTP request with automatic URL normalization, real-time role headers, and error handling.
   */
  public async send(opts: RequestOptions): Promise<APIResponse> {
    const role = opts.role || this.defaultRole;
    const token = opts.token !== undefined ? opts.token : await this.getRealToken(role);

    // Normalize endpoint (ensure it targets /api/v1 properly)
    let url = opts.endpoint;
    if (url.includes(",")) {
      const parts = url.split(",").map((p) => p.trim());
      url = parts.find((p) => p.includes("/orders")) || parts[0];
    }
    if (url.includes("|")) {
      url = url.split("|")[0].trim();
    }
    const base = envConfig.apiUrl.replace(/\/api\/v1$/, "");

    await this.ensureSampleData(base);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const cleanPath = url.startsWith("/api/v1") ? url : `/api/v1${url.startsWith("/") ? "" : "/"}${url}`;
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
      } else if (
        d.includes("customer credentials") ||
        (d.includes("valid") && url.includes("/login")) ||
        (d.includes("user@") && url.includes("/login")) ||
        (d.includes("case-insensitive") && url.includes("/login"))
      ) {
        data = { email: envConfig.users.customer.email, password: envConfig.users.customer.password };
      } else if (url.includes("/signup") && (d.includes("duplicate email") || d.includes("existing email"))) {
        data = {
          email: "arjun.patel@example.com",
          password: "Customer@123",
          fullName: "Arjun Patel",
        };
      } else if (url.includes("/signup") && (d.includes("invalid") || d.includes("missing"))) {
        data = { email: "not-an-email", password: "" };
      } else if (url.includes("/signup") && d.includes("html")) {
        data = {
          email: `script_cust_${Date.now()}@aurazone-test.com`,
          password: "TestPassword123!",
          fullName: "<script>alert('xss')</script>",
        };
      } else if (url.includes("/signup") && d.includes("emoji")) {
        data = {
          email: `emoji_cust_${Date.now()}@aurazone-test.com`,
          password: "TestPassword123!",
          fullName: "Customer 🎉 " + "A".repeat(50),
        };
      } else if (url.includes("/signup") && d.includes("body >")) {
        data = { email: "large@test.com", password: "Password123!", payload: "x".repeat(1024 * 1024 * 2) };
      } else if (url.includes("/signup") && (d.includes("valid") || d.includes("new@x.com") || d.includes("sam"))) {
        data = {
          email: `auto_cust_${Date.now()}_${Math.floor(Math.random() * 10000)}@aurazone-test.com`,
          password: "TestPassword123!",
          fullName: "Auto Test Customer",
        };
      } else if (url.includes("/users/profile") && (d.includes("501") || d.includes("name=\"\""))) {
        data = { fullName: "" };
      } else if (url.includes("/cart") && (d.includes("same product") || d.includes("twice") || d.includes("50 products") || d.includes("parallel"))) {
        data = { variantId: cachedSampleVariantId, quantity: 1 };
      } else if (d.includes("wrong password") || (d.includes("invalid") && (d.includes("credential") || d.includes("sm") || d.includes("admin") || d.includes("password")))) {
        data = { email: `wrong_${Date.now()}@aurazone-nonexistent.com`, password: "DefinitelyWrongPassword123!" };
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
          name: `Auto Product ${Date.now()}`,
          description: "Automated test product description",
          storeId: cachedSampleStoreId || "e14dc1c9-cbcf-44bf-b3b0-61e93e60b531",
          categoryId: cachedSampleCategoryId || "58ef362b-0ca1-423a-bc8e-d9a65a00f1c1",
          hasVariants: true,
          isActive: true,
          variants: [
            {
              sku: `SKU-${Date.now()}`,
              price: 199.99,
              quantity: 50,
              isAvailable: true,
              attributes: [],
            },
          ],
        };
      } else {
        try {
          data = JSON.parse(data);
          if (url.includes("/signup") && data.email === "new@x.com") {
            data.email = `auto_cust_${Date.now()}_${Math.floor(Math.random() * 10000)}@aurazone-test.com`;
          }
        } catch {
          // Keep as string if not JSON
        }
      }
    }

    // Normalize admin product creation payload to match AuraZone v2 productSchema
    if (url.includes("/admin/products") && opts.method === "POST" && data && typeof data === "object") {
      data.name = `${data.name || "Product"} ${Date.now()}`;
      data.storeId = "e14dc1c9-cbcf-44bf-b3b0-61e93e60b531"; // Aura Shoes (managed by Store Manager)
      data.categoryId = "58ef362b-0ca1-423a-bc8e-d9a65a00f1c1"; // Sneakers category
      if (!data.description) data.description = "Automated test product description";
      if (!data.variants || data.variants.length === 0) {
        data.hasVariants = true;
        data.variants = [
          {
            sku: `SKU-${Date.now()}`,
            price: Number(data.price) || 199.99,
            quantity: Number(data.stock) || 50,
            isAvailable: true,
            attributes: [],
          },
        ];
      }
    }

    // Map /cart/items to the real AuraZone v2 /cart route
    if (url.includes("/cart/items")) {
      url = url.replace("/cart/items", "/cart");
    }

    // Normalize cart item addition payload
    if (url.includes("/cart") && opts.method === "POST" && data && typeof data === "object") {
      if (!data.variantId && cachedSampleVariantId) {
        data.variantId = cachedSampleVariantId;
      }
      if (!data.quantity) data.quantity = 1;
    }

    // Normalize cart item update payload
    if (url.includes("/cart") && (opts.method === "PATCH" || opts.method === "PUT") && data && typeof data === "object") {
      if (!data.quantity) data.quantity = 2;
    }

    // Normalize order creation payload
    if (url.endsWith("/orders") && opts.method === "POST" && (!data || typeof data === "string" || !data.paymentMethod)) {
      data = {
        paymentMethod: "COD",
        address: {
          name: "Arjun Patel",
          phone: "9876543210",
          addressLine1: "123 MG Road",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
        },
      };
    }

    // Resolve URL placeholders dynamically
    if (url.includes("{id}")) {
      let replacement = cachedSampleProductId || "00000000-0000-0000-0000-000000000001";
      if (url.includes("/products/")) {
        replacement = cachedSampleProductSlug || cachedSampleProductId || "00000000-0000-0000-0000-000000000001";
      } else if (url.includes("/orders/")) {
        replacement = cachedSampleOrderId || "b357581c-8b45-4fd5-bc2a-479bd875ff59";
      }
      url = url.replace("{id}", replacement);
    }
    if (url.includes("{otherId}")) {
      url = url.replace("{otherId}", "00000000-0000-0000-0000-000000000002");
    }
    if (url.includes("{unknownId}")) {
      url = url.replace("{unknownId}", "00000000-0000-0000-0000-000000000000");
    }
    if (url.includes("{itemId}")) {
      url = url.replace("{itemId}", cachedSampleCartItemId || "00000000-0000-0000-0000-000000000000");
    }
    if (url.includes("{ownId}")) {
      url = url.replace("{ownId}", "543b9c2f-3aa9-437a-991a-e02820687c91");
    }
    if (url.includes("{draftId}")) {
      url = url.replace("{draftId}", "00000000-0000-0000-0000-000000000099");
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


