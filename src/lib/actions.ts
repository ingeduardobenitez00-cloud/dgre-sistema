"use server";

import { imageAutoTagging, type ImageAutoTaggingInput } from "@/ai/flows/image-auto-tagging";

export async function generateTagsAction(
  input: ImageAutoTaggingInput
): Promise<{ tags: string[] } | { error: string }> {
  try {
    const result = await imageAutoTagging(input);
    return result;
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate tags.' };
  }
}
