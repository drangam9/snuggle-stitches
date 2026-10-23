ALTER TABLE products ADD COLUMN images_json TEXT
  CHECK (images_json IS NULL OR (json_valid(images_json) AND json_type(images_json) = 'array' AND json_array_length(images_json) <= 5));
