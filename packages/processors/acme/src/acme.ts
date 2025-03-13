import type { IFileChange, IPullRequestInfo, IPullRequestProcessor, IReviewComment } from '@code-hobbit/core';

export class AcmeProcessor implements IPullRequestProcessor {
  /**
   * @inheritdoc
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[]) {
    // simply comment on each file
    const comments: IReviewComment[] = files.map((file) => ({
      path: file.path,
      position: 1,
      body: `[ACME] Reviewed ${file.path}\n\nPR: ${prInfo.title}`,
      type: 'inline',
    }));

    return {
      comments,
    };
  }
}
