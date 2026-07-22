import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishPost } from "@/lib/social/postPipeline";
import { deleteFromInstagram, deleteFromFacebook } from "@/lib/social/graphApi";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.socialPost.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

// One flexible endpoint for both plain edits (caption/hashtags) and status
// transitions (approve/reject/publish_now/undo) -- they're all "update this
// post", and splitting each transition into its own route would just be
// more files for the same session-protected surface.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const post = await db.socialPost.findUnique({ where: { id } });
  if (!post || post.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof b.caption === "string" || Array.isArray(b.hashtags)) {
    const updated = await db.socialPost.update({
      where: { id },
      data: {
        ...(typeof b.caption === "string" ? { caption: b.caption } : {}),
        ...(Array.isArray(b.hashtags) ? { hashtags: b.hashtags.map(String) } : {}),
      },
    });
    return NextResponse.json({ post: updated });
  }

  if (b.action === "approve") {
    if (post.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft posts can be approved" }, { status: 400 });
    }
    const scheduledFor =
      typeof b.scheduledFor === "string" && b.scheduledFor.length > 0 ? new Date(b.scheduledFor) : new Date();
    const updated = await db.socialPost.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledFor, reviewedAt: new Date(), reviewedBy: "Morgan" },
    });
    return NextResponse.json({ post: updated });
  }

  if (b.action === "reject") {
    if (post.status === "PUBLISHED") {
      return NextResponse.json({ error: "Use undo to remove a published post" }, { status: 400 });
    }
    const updated = await db.socialPost.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: typeof b.rejectionReason === "string" ? b.rejectionReason : null,
        reviewedAt: new Date(),
        reviewedBy: "Morgan",
      },
    });
    return NextResponse.json({ post: updated });
  }

  if (b.action === "publish_now") {
    if (post.status === "PUBLISHED") {
      return NextResponse.json({ error: "Already published" }, { status: 400 });
    }
    await db.socialPost.update({ where: { id }, data: { reviewedAt: new Date(), reviewedBy: "Morgan" } });
    await publishPost(id);
    const updated = await db.socialPost.findUnique({ where: { id } });
    return NextResponse.json({ post: updated });
  }

  if (b.action === "undo") {
    if (post.status === "SCHEDULED") {
      const updated = await db.socialPost.update({
        where: { id },
        data: { status: "DRAFT", scheduledFor: null },
      });
      return NextResponse.json({ post: updated });
    }
    if (post.status === "PUBLISHED") {
      if (post.externalPostId) {
        try {
          if (post.platform === "INSTAGRAM") await deleteFromInstagram(post.externalPostId);
          else await deleteFromFacebook(post.externalPostId);
        } catch (error) {
          console.error(`Failed to delete live post ${id} from ${post.platform}:`, error);
          return NextResponse.json(
            { error: `Could not remove the live post from ${post.platform}: ${error instanceof Error ? error.message : String(error)}` },
            { status: 502 },
          );
        }
      }
      const updated = await db.socialPost.update({
        where: { id },
        data: {
          status: "REJECTED",
          externalPostId: null,
          rejectionReason: "Removed from the live platform via undo",
        },
      });
      return NextResponse.json({ post: updated });
    }
    return NextResponse.json({ error: `Cannot undo a post with status ${post.status}` }, { status: 400 });
  }

  return NextResponse.json({ error: "No recognised update in request body" }, { status: 400 });
}

// Soft delete only -- moves to Trash, never a hard delete, same pattern as
// every other feature this session. If the post was already live, use
// "undo" first to actually remove it from the platform; delete here just
// hides the local record.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.socialPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.socialPost.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ post: updated });
}
