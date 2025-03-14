import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, IReviewComment } from '../../core/mod.ts';

export class DifyProcessor implements IPullRequestProcessor {
  /**
   * @inheritdoc
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult> {
    // Default implementation - can be expanded later
    const comments: IReviewComment[] = files.map((file) => ({
      path: file.path,
      position: 1,
      body: `[DIFY] Processed ${file.path}\n\nPR: ${prInfo.title}`,
      type: 'inline',
    }));

    return {
      comments,
    };
  }
}
