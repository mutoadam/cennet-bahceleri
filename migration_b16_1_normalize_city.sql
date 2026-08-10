-- B16.1 – TÜRKİYE GENELİ NORMALİZASYON MIGRATION
-- Mevcut Sakarya kayıtlarını normalize eder.

-- 1. suggestions tablosu
UPDATE suggestions
SET city = 'Sakarya'
WHERE city IS NULL OR trim(city) = '';

-- 2. programs tablosu
UPDATE programs
SET city = 'Sakarya'
WHERE city IS NULL OR trim(city) = '';

-- 3. mosque_locations tablosu
UPDATE mosque_locations
SET city = 'Sakarya'
WHERE city IS NULL OR trim(city) = '';

-- Not: Bu migration manuel olarak Supabase SQL Editor üzerinden çalıştırılmalıdır.
