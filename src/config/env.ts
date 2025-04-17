import dotenv from "dotenv";

dotenv.config();

export default {
  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // API Server
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  host: process.env.HOST || "localhost",

  // WATI API Configuration
  wati: {
    apiUrl:
      process.env.WATI_API_URL ||
      "https://live-mt-server.wati.io/200057/api/v1",
    apiToken:
      process.env.WATI_API_TOKEN ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3OTI2M2I3My0zY2EzLTQxMjItYTEwYS1lOTc3MDA4M2RlMTUiLCJ1bmlxdWVfbmFtZSI6ImFkbWluaXN0cmF0b3JAZmlqaWNhcmUuY29tLmZqIiwibmFtZWlkIjoiYWRtaW5pc3RyYXRvckBmaWppY2FyZS5jb20uZmoiLCJlbWFpbCI6ImFkbWluaXN0cmF0b3JAZmlqaWNhcmUuY29tLmZqIiwiYXV0aF90aW1lIjoiMDMvMjYvMjAyNSAwNjoxMToyMiIsInRlbmFudF9pZCI6IjIwMDA1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.y3fToRbBlw4siAZTYZ65oDRJfg7KyjxqNX2BgC-ddas",
    welcomeTemplate: process.env.WATI_WELCOME_TEMPLATE || "new_chat_v1",
    policySummaryTemplate:
      process.env.WATI_POLICY_SUMMARY_TEMPLATE || "policy_summary",
    defaultBroadcastName:
      process.env.WATI_DEFAULT_BROADCAST_NAME || "customer_support",
  },

  // PayPal
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    mode: process.env.PAYPAL_MODE || "sandbox",
  },

  // App Configuration
  app: {
    name: process.env.APP_NAME || "Insurance WhatsApp Bot",
    environment: process.env.NODE_ENV || "development",
    appHost: process.env.APP_HOST || "http://localhost:3000",
  },
};
