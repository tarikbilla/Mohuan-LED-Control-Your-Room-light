import { NextRequest, NextResponse } from "next/server";

const LED_SERVICE_PORT = 3030;

async function proxyRequest(
  request: NextRequest,
  method: string,
  path: string
) {
  const searchParams = request.nextUrl.searchParams;
  const port = searchParams.get("XTransformPort") || LED_SERVICE_PORT;
  
  // Remove XTransformPort from query params
  searchParams.delete("XTransformPort");
  
  // Build the target URL
  const queryString = searchParams.toString();
  const targetUrl = `http://localhost:${port}/${path}${queryString ? `?${queryString}` : ""}`;
  
  try {
    // Get request body if present
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await request.text();
    }
    
    // Make the proxy request
    const response = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    
    // Get response body
    const responseText = await response.text();
    
    // Return the proxied response
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { 
        error: "Failed to connect to LED backend service. Make sure the Python service is running on port 3030.",
        hint: "Run: python led-backend/led_service.py"
      },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET", "state");
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") || "";
  return proxyRequest(request, "POST", path);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
