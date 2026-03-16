import { NextRequest, NextResponse } from "next/server";

const LED_SERVICE_PORT = 3030;

async function proxyRequest(
  request: NextRequest,
  method: string,
  path: string[]
) {
  const searchParams = request.nextUrl.searchParams;
  const port = searchParams.get("XTransformPort") || LED_SERVICE_PORT;
  
  // Remove XTransformPort from query params
  searchParams.delete("XTransformPort");
  
  // Build the target URL
  const pathString = path.join("/");
  const queryString = searchParams.toString();
  const targetUrl = `http://localhost:${port}/${pathString}${queryString ? `?${queryString}` : ""}`;
  
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
      { error: "Failed to connect to LED service" },
      { status: 503 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return proxyRequest(request, "GET", slug);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return proxyRequest(request, "POST", slug);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return proxyRequest(request, "PUT", slug);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return proxyRequest(request, "DELETE", slug);
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
