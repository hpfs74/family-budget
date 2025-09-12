# Budget App

A full-stack application built with Nx monorepo, React frontend, and AWS CDK backend.

## Architecture

- **Frontend**: React application built with Vite
- **Backend**: AWS Lambda function with API Gateway
- **Infrastructure**: AWS CDK for infrastructure as code

## Features

- React frontend that displays "Hello World"
- API endpoint that returns current date and time
- AWS Lambda function with API Gateway integration
- CORS enabled for frontend-backend communication

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

1. Install dependencies:
```sh
npm install
```

2. Bootstrap CDK (first time only):
```sh
npm run cdk:bootstrap
```

### Development

#### Frontend Development
```sh
# Start the React development server
npm run serve

# Build the frontend
npm run build
```

#### Backend Development
```sh
# Synthesize CDK stack (generates CloudFormation)
npm run cdk:synth

# Deploy to AWS
npm run cdk:deploy

# View differences before deployment
npm run cdk:diff
```

### Deployment

**Note**: There are some TypeScript module resolution issues with the current CDK setup. To resolve this, you may need to either:
- Convert the CDK files to CommonJS syntax, or
- Adjust the TypeScript configuration for better ES module support

1. Deploy the backend infrastructure (once CDK issues are resolved):
```sh
npm run cdk:deploy
```

2. Update the frontend with the API endpoint:
   - After deployment, CDK will output the API Gateway URL
   - Set the `REACT_APP_API_ENDPOINT` environment variable or update the code directly in `apps/frontend/src/app/app.tsx`

3. Build and deploy frontend to your hosting service:
```sh
npm run build
```

### CDK Structure

The CDK application is located in `backend/src/`:
- `main.ts` - CDK app entry point
- `backend-stack.ts` - Stack definition with Lambda and API Gateway
- The Lambda function returns current date/time with CORS headers enabled

### Testing
```sh
# Run all tests
npm test

# Test frontend only
npm run test:frontend

# Test backend only  
npm run test:backend
```

### Linting
```sh
# Lint all projects
npm run lint

# Lint frontend only
npm run lint:frontend

# Lint backend only
npm run lint:backend
```

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/react:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/react:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/tutorials/react-monorepo-tutorial?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
