# <img src="images/icon.png" alt="Visual Studio Code icon" align="center" width="45"/> Visual Studio Code | Alfred Workflow

Control Visual Studio Code directly from Alfred. Open windows, access recent projects and files, search files and folders, and manage extensions.

**Supports:** Visual Studio Code, VS Code Insiders, and VSCodium.

## Download

- Download it directly [from GitHub here](https://github.com/vanstrouble/vscode-alfred-workflow/releases/latest).

## Usage

### New VS Code window (code)

<img src="images/code.png" alt="Alfred new VS Code window" width="570"/>

Opens a fresh VS Code window, ready for a new project or quick edits.

- **Keyword:** `code`

### Recent projects and files (coder)

<img src="images/coder.png" alt="Alfred recent projects" width="570"/>

Browse your recently opened projects, workspaces, and files. Search by name to find what you need instantly.

- **Keyword:** `coder`
  - `↩` Open the selected project/file in VS Code
  - `⌘` `↩` Reveal in Finder
  - `⌥` `↩` View file in Alfred
  - `⌃` `↩` Remove from recent list
  - `⌃` `⇧` `↩` Remove all recent entries

#### Examples:

| Command         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| `coder`          | Lists all recent projects and files.                                        |
| `coder myproject`| Filters results to match "myproject".                                       |

### Find and open files or folders (codef)

<img src="images/codef.png" alt="Alfred find and open" width="570"/>

Search for any file or folder on your Mac and open it directly in VS Code.

- **Keyword:** `codef`
  - `↩` Open in VS Code
  - `⌘` `↩` Reveal in Finder
  - `⌥` `↩` View file in Alfred

### Open path in VS Code (codep)

<img src="images/codep.png" alt="Alfred open path" width="570"/>

Open any folder in VS Code by typing its path. If you don't provide a path, the current Finder window will be opened in VS Code automatically. This action is also available via **Universal Actions**.

- **Keyword:** `codep [path]`

#### Examples:

| Command                                              | Description                                      |
|------------------------------------------------------|--------------------------------------------------|
| `codep`                                   | Opens the frontmost Finder window in VS Code.    |
| `codep ~/Projects/my-folder`                | Opens the specified folder in VS Code.           |

### Search extensions (codes)

<img src="images/codes.png" alt="Alfred search extensions" width="570"/>

Search the VS Code Marketplace directly from Alfred. Find new extensions without opening your browser.

- **Keyword:** `codes [query]`
  - `↩` Install the extension
  - `⌘` `↩` View on VS Code Marketplace

#### Examples:

| Command                  | Description                                      |
|--------------------------|--------------------------------------------------|
| `codes python`     | Searches for Python-related extensions.          |
| `codes prettier`   | Searches for Prettier and formatting extensions. |

### Installed extensions (codex)

<img src="images/codex.png" alt="Alfred installed extensions" width="570"/>

View all your installed extensions. Search by name to quickly find what you're looking for.

- **Keyword:** `codex`
  - `↩` Open extension in VS Code
  - `⌘` `↩` View on VS Code Marketplace
  - `⌃` `↩` Uninstall extension

## Customization

You can customize the keywords for each command directly in Alfred's workflow settings. Change them to whatever feels natural to you.

## Acknowledgments

This workflow is based on [Alex Chan’s original Alfred workflow for VS Code](https://github.com/alexchantastic/alfred-open-with-vscode-workflow), and has been extended with additional features and improvements.
