# Contributing to SwapSmith

First off, thanks for taking the time to contribute! 🎉

SwapSmith is a voice-activated crypto trading assistant built with Next.js, OpenAI, and SideShift.ai. We welcome contributions from the community to help make cross-chain swaps easier and more accessible.

## 🛠️ Development Workflow

To get started with local development, follow these steps:

1.  **Fork and Clone**
    Fork the repository to your own GitHub account and then clone it to your local device:
    ```bash
    git clone [https://github.com/your-username/swapsmith.git](https://github.com/your-username/swapsmith.git)
    cd swapsmith
    ```

2.  **Install Dependencies**
    We use `npm` for package management. Install the required packages:
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory based on the example provided:
    ```bash
    cp .env.example .env
    ```
    You will need keys for:
    - OpenAI API
    - SideShift.ai API (optional but recommended)
    - WalletConnect Project ID (for Wagmi/Web3Modal)

4.  **Start the Development Server**
    Run the local development server:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 📏 Code Quality

We use `eslint` to maintain code quality. Before submitting a PR, please ensure your code is linted:

```bash
npm run lint
```

## 🚀 Submitting a Pull Request
1. **Create a Branch:** Create a new branch for your feature or bugfix: `git checkout -b feature/amazing-feature`
2. **Commit Changes:** Make sure your commit messages are clear and descriptive.
3. **Push to GitHub:** Push your branch to your fork.
4.**Open a PR:** Go to the original SwapSmith repository and open a Pull Request.
    - Describe your changes in detail.
    - Link to any relevant issues.
    - Attach screenshots if your changes impact the UI.

## 🔮 Ideas for Contribution
If you're looking for something to work on, check out the "Future Ideas" section in our README:
- Integrating DeFi protocols (e.g., "Swap and stake").
- Improving the voice input integration.
- Adding support for Limit Orders.