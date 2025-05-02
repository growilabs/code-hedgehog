import { ImpactLevel } from '../../deps.ts';
import { uploadFile } from '../../internal/mod.ts';
import { processReviewResponse } from '../../internal/run-workflow.ts';
import type { DifyRequestBody } from '../../internal/schema.ts';

async function main() {
  const baseUrl = Deno.env.get('DIFY_API_BASE_URL');
  if (!baseUrl) {
    throw new Error('DIFY_API_BASE_URL is not set in .act.env');
  }

  const apiKey = Deno.env.get('DIFY_API_KEY_REVIEW');
  if (!apiKey) {
    throw new Error('DIFY_API_KEY_REVIEW is not set in .act.secrets');
  }

  const testAspects = [
    {
      key: 'security',
      description: 'Implementation of authentication system',
      impact: ImpactLevel.High,
    },
    {
      key: 'domain:auth',
      description: 'User authentication and authorization features',
      impact: ImpactLevel.Medium,
    },
  ];

  const testOverallSummary = {
    description: 'Adding JWT-based authentication system',
    crossCuttingConcerns: ['Security practices need to be reviewed across the system', 'Error handling patterns should be consistent'],
  };

  // Upload aspects data
  console.log('Uploading aspects data...');
  const aspectsFileId = await uploadFile(baseUrl, apiKey, 'moogle', testAspects);
  console.log('Aspects uploaded, ID:', aspectsFileId);

  // Upload overall summary data
  console.log('Uploading overall summary data...');
  const overallSummaryFileId = await uploadFile(baseUrl, apiKey, 'moogle', testOverallSummary);
  console.log('Overall summary uploaded, ID:', overallSummaryFileId);

  // Execute workflow
  console.log('Executing workflow...');
  const requestBody: DifyRequestBody = {
    inputs: {
      title: 'Add user authentication feature',
      description: 'This PR implements user authentication using JWT tokens',
      filePath: 'src/auth/auth.service.ts',
      patch: `@@ -1,3 +1,35 @@
+ import { Injectable } from '@nestjs/common';
+ import { JwtService } from '@nestjs/jwt';
+ import { UserService } from '../user/user.service';
+
+ @Injectable()
+ export class AuthService {
+   constructor(
+     private userService: UserService,
+     private jwtService: JwtService,
+   ) {}
+
+   async validateUser(email: string, password: string): Promise<any> {
+     const user = await this.userService.findByEmail(email);
+     if (user && user.password === password) {
+       const { password, ...result } = user;
+       return result;
+     }
+     return null;
+   }
+
+   async login(user: any) {
+     const payload = { email: user.email, sub: user.id };
+     return {
+       access_token: this.jwtService.sign(payload),
+     };
+   }
+ }`,
      instructions: 'Focus on security best practices and error handling',
      aspects: {
        transfer_method: 'local_file',
        upload_file_id: aspectsFileId,
        type: 'document',
      },
      overallSummary: {
        transfer_method: 'local_file',
        upload_file_id: overallSummaryFileId,
        type: 'document',
      },
    },
    response_mode: 'blocking',
    user: 'moogle',
  };

  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  // Get raw response data
  const data = await response.json();
  console.log('\nRaw Response Body:', JSON.stringify(data, null, 2));

  try {
    // Process and validate response
    console.log('\nAttempting to process and validate response...');
    const validatedData = processReviewResponse(data);
    console.log('\nValidated Review Response:', JSON.stringify(validatedData, null, 2));
  } catch (error) {
    console.error('\nValidation Error:', error);
    console.log('\nOutputs data:', data.data?.outputs);
  }
}

main();
