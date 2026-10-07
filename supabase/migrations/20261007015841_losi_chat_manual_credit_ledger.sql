alter table public.losi_chat_ledger drop constraint losi_chat_ledger_reason_check;
alter table public.losi_chat_ledger add constraint losi_chat_ledger_reason_check check(reason in('purchase','refund','message','manual_grant'));
alter table public.losi_chat_ledger add column note text check(note is null or length(note) between 3 and 300);
