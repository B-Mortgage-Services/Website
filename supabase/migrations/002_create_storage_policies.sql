-- Storage Bucket RLS Policies for wellness-pdfs
-- Run this AFTER creating the wellness-pdfs bucket in the Supabase dashboard
-- (Storage > Create new bucket > "wellness-pdfs" > Public: YES)

-- Allow anonymous uploads to the wellness-pdfs bucket
CREATE POLICY "Allow public upload to wellness-pdfs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'wellness-pdfs');

-- Allow anonymous reads from the wellness-pdfs bucket
CREATE POLICY "Allow public read from wellness-pdfs"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'wellness-pdfs');

-- Allow overwriting (for upsert functionality)
CREATE POLICY "Allow public update in wellness-pdfs"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'wellness-pdfs');
