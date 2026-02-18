import { getSession } from "@/lib/auth/guards";
import { pdfQueue } from "@/lib/pdf/queue";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return apiError("未認証です", 401);
  }

  const status = pdfQueue.getStatus();
  return apiSuccess(status);
}
