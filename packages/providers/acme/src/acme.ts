import type { IFileChange, IPullRequestInfo, IReviewComment, IReviewProvider } from '@code-hobbit/core';

export class AcmeReviewProvider implements IReviewProvider {
  async reviewBatch(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IReviewComment[]> {
    // simply comment on each file
    return files.map((file) => ({
      path: file.path,
      position: 1,
      body: `[ACME] Reviewed ${file.path}\n\nPR: ${prInfo.title}`,
      type: 'inline',
    }));
  }
}
