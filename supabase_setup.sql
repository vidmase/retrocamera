-- Create the photos table
create table if not exists photos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users default auth.uid(),
  room_id text not null default 'global',
  data_url text not null,
  caption text,
  x float not null,
  y float not null,
  rotation float not null,
  z_index int not null
);

-- Enable Realtime for this table
alter publication supabase_realtime add table photos;

-- Enable Row Level Security (RLS)
alter table photos enable row level security;

-- Create policies (Open for all for this demo, but scoped to rooms in logic)
create policy "Anyone can view photos" on photos for select using (true);
create policy "Authenticated users can insert photos" on photos for insert with check (auth.role() = 'authenticated');
create policy "Users can update their own photos" on photos for update using (auth.uid() = user_id);
