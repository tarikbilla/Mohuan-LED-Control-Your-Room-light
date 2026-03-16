import { NextRequest } from "next/server";
import { proxyToBackend } from "../proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "GET", "scan");
}
