// Meta Graph API client for publishing real posts to Instagram and
// Facebook. Confirmed flow (web research + a read of the old `reyse`
// backend's working carousel code, 22 July 2026):
//   Instagram single:   create container -> poll until FINISHED -> publish
//   Instagram carousel: create child containers (is_carousel_item) -> poll
//                        each -> create parent CAROUSEL container -> poll
//                        -> publish
//   Facebook single:    POST /{page-id}/photos (url + caption) directly
//   Facebook multi:     upload each photo unpublished -> POST /{page-id}/feed
//                        with attached_media referencing each media_fbid
//                        (Facebook has no native organic "carousel" post
//                        type the way Instagram does)
const INSTAGRAM_API_VERSION = "v25.0";
const FACEBOOK_API_VERSION = "v25.0";

// app.reyse.co.uk isn't actually attached to this Railway service yet (see
// reyse-app/CLAUDE.md) -- same workaround used everywhere else this
// session for cross-service URLs. Switch once the domain is fixed.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://reyse-app-production.up.railway.app";

function assetUrl(assetId: string): string {
  return `${PUBLIC_BASE_URL}/api/public/social/assets/${assetId}`;
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function graphPost(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  const json = (await res.json()) as Record<string, unknown> & GraphErrorBody;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

async function waitForContainerFinished(containerId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    const json = (await res.json()) as { status_code?: string } & GraphErrorBody;
    if (json.error) throw new Error(`Graph API error checking container status: ${JSON.stringify(json.error)}`);
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR" || json.status_code === "EXPIRED") {
      throw new Error(`Instagram media container failed: ${json.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Instagram media container timed out waiting to finish processing");
}

export interface PublishResult {
  externalPostId: string;
}

export async function publishToInstagram(params: {
  caption: string;
  images: { assetId: string }[];
}): Promise<PublishResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !userId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID not configured");
  }
  const base = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${userId}`;

  let creationId: string;

  if (params.images.length === 1) {
    const container = await graphPost(`${base}/media`, {
      image_url: assetUrl(params.images[0].assetId),
      caption: params.caption,
      access_token: accessToken,
    });
    creationId = String(container.id);
    await waitForContainerFinished(creationId, accessToken);
  } else {
    const childIds: string[] = [];
    for (const image of params.images) {
      const child = await graphPost(`${base}/media`, {
        image_url: assetUrl(image.assetId),
        is_carousel_item: "true",
        access_token: accessToken,
      });
      const childId = String(child.id);
      await waitForContainerFinished(childId, accessToken);
      childIds.push(childId);
    }
    const carousel = await graphPost(`${base}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption: params.caption,
      access_token: accessToken,
    });
    creationId = String(carousel.id);
    await waitForContainerFinished(creationId, accessToken);
  }

  const publish = await graphPost(`${base}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });

  return { externalPostId: String(publish.id) };
}

export async function publishToFacebook(params: {
  caption: string;
  images: { assetId: string }[];
}): Promise<PublishResult> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!accessToken || !pageId) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID not configured");
  }
  const base = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}`;

  if (params.images.length === 1) {
    const result = await graphPost(`${base}/photos`, {
      url: assetUrl(params.images[0].assetId),
      caption: params.caption,
      access_token: accessToken,
    });
    return { externalPostId: String(result.post_id ?? result.id) };
  }

  const mediaFbids: string[] = [];
  for (const image of params.images) {
    const uploaded = await graphPost(`${base}/photos`, {
      url: assetUrl(image.assetId),
      published: "false",
      access_token: accessToken,
    });
    mediaFbids.push(String(uploaded.id));
  }

  const feedParams = new URLSearchParams({ message: params.caption, access_token: accessToken });
  mediaFbids.forEach((id, i) => {
    feedParams.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
  });
  const res = await fetch(`${base}/feed`, { method: "POST", body: feedParams });
  const json = (await res.json()) as Record<string, unknown> & GraphErrorBody;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${JSON.stringify(json.error ?? json)}`);
  }

  return { externalPostId: String(json.id) };
}

// Genuine "undo" for an already-published post -- both platforms actually
// support this (confirmed via research, not assumed): Instagram via
// `DELETE /<ig-media-id>` (deleting a carousel's parent container removes
// the whole album), Facebook via `DELETE /<post-id>`. Not implementing
// this honestly and instead just hiding the row locally would let the
// admin UI claim "undo" while the post stays live -- worse than not
// offering the feature at all.
export async function deleteFromInstagram(externalPostId: string): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) throw new Error("INSTAGRAM_ACCESS_TOKEN not configured");
  const res = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${externalPostId}?access_token=${accessToken}`,
    { method: "DELETE" },
  );
  const json = (await res.json()) as Record<string, unknown> & GraphErrorBody;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error deleting Instagram post: ${JSON.stringify(json.error ?? json)}`);
  }
}

export async function deleteFromFacebook(externalPostId: string): Promise<void> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN not configured");
  const res = await fetch(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${externalPostId}?access_token=${accessToken}`, {
    method: "DELETE",
  });
  const json = (await res.json()) as Record<string, unknown> & GraphErrorBody;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error deleting Facebook post: ${JSON.stringify(json.error ?? json)}`);
  }
}
