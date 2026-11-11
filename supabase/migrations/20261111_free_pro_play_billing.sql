-- FichaPro: plano Gratuito (anúncios + limites) e Pro (subscrição Google Play)
-- (ainda por aplicar no projeto: pendente de confirmação)
alter table public.fp_tenants drop constraint if exists fp_tenants_plan_check;
alter table public.fp_tenants add constraint fp_tenants_plan_check check (plan in ('free','trial','active','past_due','canceled'));
alter table public.fp_tenants alter column plan set default 'free';
update public.fp_tenants set plan = 'free' where plan = 'trial';

create or replace function public.fp_is_pro(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fp_tenants x where x.id = t and (x.paid_until is not null and x.paid_until > now()))
$$;
create or replace function public.fp_can_write(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fp_members m where m.tenant_id = t and m.user_id = auth.uid() and m.role in ('owner','admin','editor'))
$$;

create table public.fp_plan_limits (store text primary key, max_free int not null check (max_free >= 0));
insert into public.fp_plan_limits values ('recipes', 10), ('ingredients', 50);
alter table public.fp_plan_limits enable row level security;
create policy fp_plan_limits_read on public.fp_plan_limits for select to authenticated using (true);
revoke all on public.fp_plan_limits from anon;

create or replace function public.fp_enforce_limits() returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int; n int;
begin
  if new.deleted then return new; end if;
  if exists (select 1 from public.fp_records r where r.tenant_id = new.tenant_id and r.store = new.store and r.id = new.id) then return new; end if;
  select max_free into lim from public.fp_plan_limits where store = new.store;
  if lim is null or coalesce(new.data->>'demo','false') = 'true' or public.fp_is_pro(new.tenant_id) then return new; end if;
  select count(*) into n from public.fp_records r
   where r.tenant_id = new.tenant_id and r.store = new.store and not r.deleted and coalesce(r.data->>'demo','false') <> 'true';
  if n >= lim then
    raise exception 'FP_LIMIT: o plano gratuito permite até % registos em %', lim, new.store using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger fp_records_limits before insert on public.fp_records for each row execute function public.fp_enforce_limits();

drop policy if exists fp_invites_insert on public.fp_invites;
create policy fp_invites_insert on public.fp_invites for insert to authenticated
  with check (public.fp_role(tenant_id) in ('owner','admin') and public.fp_is_pro(tenant_id));

create table public.fp_subscriptions (
  purchase_token text primary key,
  tenant_id uuid not null references public.fp_tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  product_id text, base_plan_id text, state text, expiry_time timestamptz, auto_renewing boolean,
  test_purchase boolean not null default false, raw jsonb, updated_at timestamptz not null default now()
);
create index fp_subscriptions_tenant_idx on public.fp_subscriptions(tenant_id);
alter table public.fp_subscriptions enable row level security;
create policy fp_subscriptions_select on public.fp_subscriptions for select to authenticated using (public.fp_role(tenant_id) in ('owner','admin'));
revoke all on public.fp_subscriptions from anon;

revoke execute on function public.fp_is_pro(uuid), public.fp_enforce_limits() from anon, public;
grant execute on function public.fp_is_pro(uuid) to authenticated;
