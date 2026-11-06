-- Track whether a guest arrived by tapping the NFC tag or scanning the QR backup
alter table events add column source text not null default 'nfc' check (source in ('nfc', 'qr'));
