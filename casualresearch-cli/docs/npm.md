# NPM Package Management

This monorepo contains two main packages: `@google/casual-research-cli` and `@google/casual-research-cli-core`.

## `@google/casual-research-cli`

This is the main package for the Casual Research CLI. It is responsible for the user interface, command parsing, and all other user-facing functionality.

The package is built as a single, self-contained executable that bundles all of the package's dependencies, including `@google/casual-research-cli-core`. This means that whether a user installs the package with `npm install -g @google/casual-research-cli` or runs it directly with `npx @google/casual-research-cli`, they are using this single, self-contained executable.

## `@google/casual-research-cli-core`

This package contains the core logic for interacting with the casualresearch API. It is responsible for making API requests, handling authentication, and managing the local cache.

## Release Process

### Manual Release

Releases are managed through the [release.yml](https://github.com/google-casualresearch/casual-research-cli/actions/workflows/release.yml) GitHub Actions workflow. To perform a manual release for a patch or hotfix:

1. **Create a new branch** from the main branch
2. **Update the version** in the root `package.json` file
3. **Commit and push** the changes
4. **Create a pull request** to merge the changes back to main
5. **Merge the pull request** (this will trigger the release workflow)

The release workflow will:
- Build the packages
- Run tests
- Publish to npm
- Create a GitHub release

### Automated Release

Every night at midnight UTC, the [Release workflow](https://github.com/google-casualresearch/casual-research-cli/actions/workflows/release.yml) runs automatically on a schedule. It performs the following steps:

1. **Checks for new commits** on the main branch
2. **Determines the next version** based on conventional commits
3. **Creates a release branch** with the new version
4. **Builds and tests** the packages
5. **Publishes to npm** with the appropriate tag
6. **Creates a GitHub release** with release notes

### Nightly Builds

Nightly builds are automatically published to npm with the `@nightly` tag. These builds contain the latest development changes and are useful for testing new features.

To install a nightly build:

```bash
npm install -g @google/casual-research-cli@nightly
```

### Release Validation

After the workflow has successfully completed, you can monitor its progress in the [GitHub Actions tab](https://github.com/google-casualresearch/casual-research-cli/actions/workflows/release.yml). Once complete, you should:

1. Go to the [pull requests page](https://github.com/google-casualresearch/casual-research-cli/pulls) of the repository.
2. Look for the automated PR that was created by the release workflow.
3. Review the changes and merge the PR if everything looks correct.
4. Validate the release by running:
   - `npx -y @google/casual-research-cli@latest --version` to validate the push worked as expected if you were not doing a rc or dev tag
   - `npx -y @google/casual-research-cli@<release tag> --version` to validate the tag pushed appropriately
   - _This is destructive locally_ `npm uninstall @google/casual-research-cli && npm uninstall -g @google/casual-research-cli && npm cache clean --force &&  npm install @google/casual-research-cli@<version>`

### Troubleshooting

If the release workflow fails, you can:

1. Go to the [Actions tab](https://github.com/google-casualresearch/casual-research-cli/actions/workflows/release.yml) of the repository.
2. Find the failed workflow run
3. Check the logs to identify the issue
4. Fix the issue and re-run the workflow

Common issues include:
- Build failures due to compilation errors
- Test failures due to broken functionality
- NPM publishing issues due to authentication problems

### Package Structure

The release process creates several artifacts:

1. **Source tarballs** in the packages directory (e.g., `packages/cli/google-casual-research-cli-0.1.6.tgz`).
2. **Built packages** in the dist directories
3. **Bundled executable** in the bundle directory

The build process:
- Compiles TypeScript to JavaScript
- Bundles dependencies using esbuild
- Creates platform-specific executables
- Generates source maps for debugging

### Development Workflow

During development, you can:

1. **Build individual packages** by running `npm run build` in the package directory
2. **Build all packages** by running `npm run build:packages` from the root
3. **Link packages locally** for testing by running `npm link` in the package directory
4. **Run tests** by running `npm test` in the package directory

### Package Dependencies

The packages have the following dependency relationships:

- `@google/casual-research-cli` depends on `@google/casual-research-cli-core`
- `@google/casual-research-cli-core` is independent
- `@google/casual-research-cli-test-utils` is used by both packages for testing

### Build Configuration

The build process is configured through:

- **esbuild.config.js** - Main bundling configuration
- **tsconfig.json** - TypeScript compilation settings
- **package.json** - Package metadata and scripts

### Release Tags

The release process creates several npm tags:

- **latest** - Most recent stable release
- **nightly** - Most recent development build
- **rc** - Release candidate versions
- **dev** - Development versions

### Package Publishing

Packages are published to npm using the following process:

1. **Authentication** - Uses GitHub Actions secrets for npm authentication
2. **Versioning** - Automatically determines the next version based on conventional commits
3. **Tagging** - Creates appropriate npm tags based on the version type
4. **Publishing** - Publishes to npm with the correct tag

### Local Development

For local development, you can:

1. **Clone the repository** and install dependencies
2. **Build the packages** using the provided scripts
3. **Link packages locally** for testing
4. **Run tests** to ensure everything works correctly

### Troubleshooting Build Issues

If you encounter build issues:

1. **Check Node.js version** - Ensure you're using the correct version
2. **Clear npm cache** - Run `npm cache clean --force`
3. **Remove node_modules** - Delete and reinstall dependencies
4. **Check TypeScript errors** - Look for compilation issues
5. **Verify dependencies** - Ensure all required packages are installed

### Package Size Optimization

The build process includes several optimizations:

- **Tree shaking** - Removes unused code
- **Minification** - Reduces file sizes
- **Bundling** - Combines multiple files into single executables
- **Source maps** - Enables debugging of bundled code

### Release Notes

Release notes are automatically generated based on:

- **Conventional commits** - Uses commit message format to determine change types
- **Pull request titles** - Includes PR titles in release notes
- **Issue references** - Links to related issues and PRs

### Security

Security releases follow the same process as regular releases but may include:

- **Immediate publishing** - Security fixes are published as soon as possible
- **Security advisories** - GitHub security advisories for vulnerabilities
- **CVE assignments** - Common Vulnerabilities and Exposures identifiers

### Support

For issues with the release process:

1. **Check the documentation** - Review this file and related docs
2. **Review workflow logs** - Look at GitHub Actions for error details
3. **Create an issue** - Report problems through GitHub issues
4. **Contact maintainers** - Reach out to project maintainers

### Future Improvements

Planned improvements to the release process include:

- **Automated testing** - More comprehensive test coverage
- **Performance monitoring** - Track build and publish performance
- **Rollback capability** - Ability to quickly revert problematic releases
- **Multi-platform builds** - Support for additional operating systems

### Contributing

To contribute to the release process:

1. **Review the code** - Understand how the current system works
2. **Propose changes** - Create issues for suggested improvements
3. **Submit PRs** - Implement and test your changes
4. **Follow guidelines** - Adhere to the project's contribution guidelines

### Resources

Additional resources for understanding the release process:

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [NPM publishing guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [Conventional commits specification](https://www.conventionalcommits.org/)
- [Semantic versioning](https://semver.org/)

### Conclusion

The release process is designed to be:

- **Automated** - Minimizes manual intervention
- **Reliable** - Includes comprehensive testing and validation
- **Transparent** - Provides clear visibility into the process
- **Maintainable** - Easy to understand and modify

By following this process, we ensure that Casual Research CLI releases are consistent, reliable, and easy to manage.
