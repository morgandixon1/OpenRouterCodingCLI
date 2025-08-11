/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitIgnoreParser, GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'path';

const casualresearch_IGNORE_FILE_NAME = '.casualresearchignore';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectcasualresearchIgnore?: boolean;
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private casualresearchIgnoreFilter: GitIgnoreFilter | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      const parser = new GitIgnoreParser(this.projectRoot);
      try {
        parser.loadGitRepoPatterns();
      } catch (_error) {
        // ignore file not found
      }
      this.gitIgnoreFilter = parser;
    }
    const gParser = new GitIgnoreParser(this.projectRoot);
    try {
      gParser.loadPatterns(casualresearch_IGNORE_FILE_NAME);
    } catch (_error) {
      // ignore file not found
    }
    this.casualresearchIgnoreFilter = gParser;
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(
    filePaths: string[],
    options: FilterFilesOptions = {
      respectGitIgnore: true,
      respectcasualresearchIgnore: true,
    },
  ): string[] {
    return filePaths.filter((filePath) => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      if (
        options.respectcasualresearchIgnore &&
        this.shouldcasualresearchIgnoreFile(filePath)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Checks if a single file should be git-ignored
   */
  shouldGitIgnoreFile(filePath: string): boolean {
    if (this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Checks if a single file should be casualresearch-ignored
   */
  shouldcasualresearchIgnoreFile(filePath: string): boolean {
    if (this.casualresearchIgnoreFilter) {
      return this.casualresearchIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    const { respectGitIgnore = true, respectcasualresearchIgnore = true } = options;

    if (respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
      return true;
    }
    if (respectcasualresearchIgnore && this.shouldcasualresearchIgnoreFile(filePath)) {
      return true;
    }
    return false;
  }

  /**
   * Returns loaded patterns from .casualresearchignore
   */
  getcasualresearchIgnorePatterns(): string[] {
    return this.casualresearchIgnoreFilter?.getPatterns() ?? [];
  }
}
