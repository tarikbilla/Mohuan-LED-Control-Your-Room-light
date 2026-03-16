import { NextRequest, NextResponse } from "next/server";

const LED_SERVICE_PORT = 3030;

export async function proxyToBackend(
  request: NextRequest,
  method: string,
  path: string
) {
  const targetUrl = `http://localhost:${LED_SERVICE_PORT}/${path}`;
  
  try {
    let body: string | undefined;
    if (method !== "GET") {
      body = await request.text();
    }
    
    const response = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body || undefined,
    });
    
    const responseText = await response.text();
    
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { 
        error: "LED backend not running",
        hint: "Start the backend: python led-backend/led_service.py"
      },
      { status: 503 }
    );
  }
}
