import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, IReviewComment } from '../../core/mod.ts';

export class AcmeProcessor implements IPullRequestProcessor {
  /**
   * @inheritdoc
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult> {
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
