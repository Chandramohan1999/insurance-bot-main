#!/bin/bash

# Output file
output_file="project_contents.txt"
> "$output_file"  # Create/clear output file

# Extensions to include
include_exts=("ts" "json" "prisma" "sh")

# Directories to exclude
exclude_dirs=("node_modules" ".git" "dist" "build" "coverage" ".turbo")

# Specific filenames to exclude
exclude_files=("package-lock.json" "yarn.lock" "pnpm-lock.yaml")

# Function to check if a file has a valid extension
should_include() {
  local file="$1"
  local ext="${file##*.}"

  for valid_ext in "${include_exts[@]}"; do
    if [[ "$ext" == "$valid_ext" ]]; then
      return 0
    fi
  done
  return 1
}

# Function to check if a file is in an excluded directory
is_excluded_dir() {
  local path="$1"
  for dir in "${exclude_dirs[@]}"; do
    if [[ "$path" == *"/$dir/"* ]] || [[ "$path" == *"/$dir"* ]]; then
      return 0
    fi
  done
  return 1
}

# Function to check if a file is an excluded file
is_excluded_file() {
  local filename
  filename="$(basename "$1")"
  for f in "${exclude_files[@]}"; do
    if [[ "$filename" == "$f" ]]; then
      return 0
    fi
  done
  return 1
}

# Function to add file content
add_file_content() {
  local file_path="$1"
  if [ -f "$file_path" ]; then
    echo "//$(realpath "$file_path")" >> "$output_file"
    cat "$file_path" >> "$output_file"
    echo "" >> "$output_file"
    echo "Added: $file_path"
  fi
}

# Walk through project files
while IFS= read -r -d '' file; do
  if should_include "$file" && ! is_excluded_dir "$file" && ! is_excluded_file "$file"; then
    add_file_content "$file"
  fi
done < <(find . -type f -print0)

echo "✅ Project contents written to $output_file"