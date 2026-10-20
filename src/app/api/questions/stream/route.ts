import { NextRequest } from "next/server";
import { isAdminRequest, participantIdFrom } from "@/lib/auth";
import { questionsForViewer } from "@/lib/group";
import { getListeners, listQuestions } from "@/lib/store";
import type { Question } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const listeners = getListeners();
  const isAdmin = isAdminRequest(request);
  const participantId = participantIdFrom(request);
  let send: ((questions: Question[]) => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      send = (questions: Question[]) => {
        const visible = questionsForViewer(questions, { isAdmin, participantId });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ questions: visible })}\n\n`),
        );
      };

      send(await listQuestions());
      listeners.add(send);

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (send) listeners.delete(send);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (heartbeat) clearInterval(heartbeat);
    if (send) listeners.delete(send);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
