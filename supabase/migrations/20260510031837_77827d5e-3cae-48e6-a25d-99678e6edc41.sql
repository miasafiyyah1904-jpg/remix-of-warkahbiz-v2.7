insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images');

create policy "product-images public read"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

create policy "product-images owner update"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images' and owner = auth.uid());

create policy "product-images owner delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and owner = auth.uid());
