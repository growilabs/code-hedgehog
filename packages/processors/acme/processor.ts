import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { BaseProcessor } from '../base/mod.ts';

export class AcmeProcessor extends BaseProcessor {
  /**
   * @inheritdoc
   */
  override async process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult> {
    // simply comment on each file
    const comments: IReviewComment[] = await Promise.all(
      files.map(async (file) => {
        const instructions = this.getInstructionsForFile(file.path, config);
        return {
          path: file.path,
          position: 1,
          body: `[ACME] Reviewed ${file.path}\n\nPR: ${prInfo.title}${instructions ? `\n\nInstructions:\n${instructions}` : ''}`,
          type: 'inline',
        };
      }),
    );

    return {
      comments,
    };
  }
}
