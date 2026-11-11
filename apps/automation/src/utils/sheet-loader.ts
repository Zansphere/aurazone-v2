import * as xlsxModule from "xlsx";
const xlsx: any = (xlsxModule as any).default || xlsxModule;
import fs from "fs";
import { envConfig } from "../config/env.config.js";

export interface RoleBasedTestCase {
  id: string;
  role: string;
  category: string;
  title: string;
  type: string;
  priority: string;
  preconditions: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  authHeader: string;
  requestData: string;
  steps: string;
  expectedStatus: number;
  expectedResult: string;
  masterTcRef?: string;
  automation: string;
}

export interface MasterTestCase {
  id: string;
  title: string;
  module: string;
  subModule: string;
  reqId: string;
  type: string;
  priority: string;
  preconditions?: string;
  testData?: string;
  steps?: string;
  expectedResult?: string;
  automation?: string;
}

export interface DatabaseTestCase {
  id: string;
  table: string;
  operation: string;
  constraint: string;
  description: string;
  steps: string;
  expectedResult: string;
  priority: string;
}

const cache = new Map<string, any>();

/**
 * Loads Role-Based API Test Cases from AuraZone_V2_Role_Based_API_Test_Cases.xlsx
 * @param sheetName "Public (Anonymous)" | "Customer" | "Store Manager" | "Super Admin" | "Role Access Matrix"
 */
export function loadRoleBasedCases(sheetName: string): RoleBasedTestCase[] {
  const cacheKey = `role_${sheetName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const filePath = envConfig.sheets.roleBasedApi;
  if (!fs.existsSync(filePath)) {
    console.warn(`[SheetLoader] File not found: ${filePath}`);
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn(`[SheetLoader] Sheet "${sheetName}" not found in ${filePath}`);
    return [];
  }

  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const cases: RoleBasedTestCase[] = [];

  for (const row of rows) {
    const id = row["Test Case ID"] || row["TC ID"] || "";
    if (!id || typeof id !== "string" || !id.startsWith("API-")) continue;

    const rawStatus = String(row["Expected Status"] || "200").trim();
    const parsedStatus = parseInt(rawStatus.split(/[\s/]/)[0], 10) || 200;

    const rawMethod = String(row["HTTP Method"] || "GET").trim().toUpperCase();
    const method = ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(rawMethod)
      ? (rawMethod as RoleBasedTestCase["method"])
      : "GET";

    let endpoint = String(row["Endpoint (assumed)"] || row["Endpoint"] || "/api/v1").trim();
    if (endpoint.startsWith("https://") || endpoint.startsWith("http://")) {
      try {
        endpoint = new URL(endpoint).pathname;
      } catch {}
    }

    cases.push({
      id,
      role: row["Role"] || sheetName,
      category: row["Category"] || "",
      title: row["Test Case Title"] || "",
      type: row["Test Type"] || "",
      priority: row["Priority"] || "Medium",
      preconditions: row["Preconditions"] || "",
      method,
      endpoint,
      authHeader: row["Auth Header"] || "",
      requestData: row["Request Data / Test Data"] || "",
      steps: row["Test Steps"] || "",
      expectedStatus: parsedStatus,
      expectedResult: row["Expected Result"] || "",
      masterTcRef: row["Master TC Ref"] || "",
      automation: row["Automation"] || "Yes",
    });
  }

  cache.set(cacheKey, cases);
  return cases;
}

/**
 * Loads test cases from AuraZone_V2_Test_Suite_800.xlsx
 * @param sheetName e.g. "Smoke Test Cases", "Regression Test Cases", "Automation Test Cases", "Edge Cases"
 */
export function loadSuite800Cases(sheetName: string = "Automation Test Cases"): MasterTestCase[] {
  const cacheKey = `suite800_${sheetName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const filePath = envConfig.sheets.suite800;
  if (!fs.existsSync(filePath)) {
    console.warn(`[SheetLoader] File not found: ${filePath}`);
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const cases: MasterTestCase[] = [];

  for (const row of rows) {
    const id = row["Test Case ID"] || row["TC ID"] || "";
    if (!id || typeof id !== "string" || !id.startsWith("TC-")) continue;

    cases.push({
      id,
      title: row["Test Case Title"] || row["Title"] || "",
      module: row["Module"] || "",
      subModule: row["Sub Module"] || "",
      reqId: row["Requirement ID"] || "",
      type: row["Test Type"] || "",
      priority: row["Priority"] || "Medium",
      preconditions: row["Preconditions"] || "",
      testData: row["Test Data"] || "",
      steps: row["Test Steps"] || "",
      expectedResult: row["Expected Result"] || "",
      automation: row["Automation"] || "",
    });
  }

  cache.set(cacheKey, cases);
  return cases;
}

/**
 * Loads Database Testing cases from AuraZone_V2_Database_Testing_Sheet.xlsx
 */
export function loadDatabaseCases(): DatabaseTestCase[] {
  const cacheKey = "db_cases";
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const filePath = envConfig.sheets.databaseTesting;
  if (!fs.existsSync(filePath)) {
    console.warn(`[SheetLoader] File not found: ${filePath}`);
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => n.includes("DB Test") || n.includes("Cases")) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const cases: DatabaseTestCase[] = [];

  for (const row of rows) {
    const id = row["Test Case ID"] || row["TC ID"] || row["Case ID"] || "";
    if (!id) continue;

    cases.push({
      id,
      table: row["Table Name"] || row["Table"] || row["Entity"] || "",
      operation: row["Operation"] || row["Action"] || "",
      constraint: row["Constraint Type"] || row["Constraint"] || "",
      description: row["Test Case Description"] || row["Description"] || row["Title"] || "",
      steps: row["Test Steps"] || row["Steps"] || "",
      expectedResult: row["Expected Result"] || "",
      priority: row["Priority"] || "High",
    });
  }

  cache.set(cacheKey, cases);
  return cases;
}
