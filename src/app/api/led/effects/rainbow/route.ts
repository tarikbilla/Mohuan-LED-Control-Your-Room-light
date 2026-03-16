import { NextRequest } from "next/server";
import { proxyToBackend } from "../../proxy";

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "POST", "effects/rainbow");
}
