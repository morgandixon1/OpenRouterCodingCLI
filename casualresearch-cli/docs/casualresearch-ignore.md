# Ignoring Files

This document provides an overview of the casualresearch Ignore (`.casualresearchignore`) feature of the casualresearch CLI.

The casualresearch CLI includes the ability to automatically ignore files, similar to `.gitignore` (used by Git) and `.aiexclude` (used by casualresearch Code Assist). Adding paths to your `.casualresearchignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.casualresearchignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](./tools/multi-file.md) command, any paths in your `.casualresearchignore` file will be automatically excluded.

For the most part, `.casualresearchignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.casualresearchignore` file.
- `!` negates a pattern.

You can update your `.casualresearchignore` file at any time. To apply the changes, you must restart your casualresearch CLI session.

## How to use `.casualresearchignore`

To enable `.casualresearchignore`:

1. Create a file named `.casualresearchignore` in the root of your project directory.

To add a file or directory to `.casualresearchignore`:

1. Open your `.casualresearchignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.casualresearchignore` examples

You can use `.casualresearchignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.casualresearchignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.casualresearchignore` file, delete the relevant lines.
