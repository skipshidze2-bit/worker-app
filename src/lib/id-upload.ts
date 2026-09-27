import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/**
 * Lets the user take a photo (ID card or selfie) and uploads it to the private
 * id-documents bucket, under a folder only they and admins can read.
 */
export async function captureAndUpload(userId: string, kind: 'id' | 'selfie'): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    cameraType: kind === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const result = permission.granted
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${userId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('id-documents')
    .upload(path, body, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}
