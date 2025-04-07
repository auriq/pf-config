#!/bin/bash

# This script helps create a new GitHub release with Windows packages only
# It will:
# 1. Check if the repository is initialized
# 2. Build Windows packages only
# 3. Create a new tag
# 4. Push the tag to GitHub
# 5. Provide instructions for monitoring the release build

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PageFinder Configuration - Windows Release Script ===${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${YELLOW}This directory is not a git repository. Would you like to initialize it? (y/n)${NC}"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        git init
        echo -e "${GREEN}Git repository initialized.${NC}"
    else
        echo -e "${RED}Cannot continue without a git repository.${NC}"
        exit 1
    fi
fi

# Check if the repository has a remote
remote_url=$(git config --get remote.origin.url || echo "")
if [ -z "$remote_url" ]; then
    echo -e "${YELLOW}No remote repository found. Please enter your GitHub repository URL:${NC}"
    echo -e "${YELLOW}(e.g., https://github.com/username/pf-config.git)${NC}"
    read -r repo_url
    
    git remote add origin "$repo_url"
    echo -e "${GREEN}Remote repository added.${NC}"
fi

# Get the current version from package.json
version=$(grep -o '"version": *"[^"]*"' package.json | cut -d'"' -f4)
echo -e "${BLUE}Current version in package.json: ${GREEN}$version${NC}"

# Ask for the release version
echo -e "${YELLOW}Enter the version for this release (default: $version):${NC}"
read -r release_version
release_version=${release_version:-$version}

# Validate version format
if ! [[ $release_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Invalid version format. Please use semantic versioning (e.g., 1.0.0).${NC}"
    exit 1
fi

# Update version in package.json if different
if [ "$release_version" != "$version" ]; then
    echo -e "${BLUE}Updating version in package.json to $release_version...${NC}"
    # Use sed to update the version
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS requires an empty string for -i
        sed -i '' "s/\"version\": \"$version\"/\"version\": \"$release_version\"/" package.json
    else
        # Linux and others
        sed -i "s/\"version\": \"$version\"/\"version\": \"$release_version\"/" package.json
    fi
    echo -e "${GREEN}Version updated in package.json.${NC}"
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}You have uncommitted changes. Would you like to commit them? (y/n)${NC}"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Enter a commit message:${NC}"
        read -r commit_message
        git add .
        git commit -m "$commit_message"
        echo -e "${GREEN}Changes committed.${NC}"
    else
        echo -e "${RED}Cannot continue with uncommitted changes.${NC}"
        exit 1
    fi
fi

# Build the Windows application
echo -e "${BLUE}Building the Windows application...${NC}"
echo -e "${YELLOW}This may take a while. Do you want to continue? (y/n)${NC}"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed. Please install npm first.${NC}"
        exit 1
    fi
    
    # Install dependencies
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    
    # Build for Windows only
    echo -e "${BLUE}Building for Windows...${NC}"
    npm run dist:win
    
    echo -e "${GREEN}Windows build completed.${NC}"
    
    # List the built artifacts
    echo -e "${BLUE}Built artifacts:${NC}"
    ls -la dist
else
    echo -e "${YELLOW}Skipping build step.${NC}"
fi

# Create a tag
tag_name="v$release_version"
echo -e "${BLUE}Checking if tag $tag_name already exists...${NC}"
if git rev-parse "$tag_name" >/dev/null 2>&1; then
    echo -e "${YELLOW}Tag $tag_name already exists. Would you like to overwrite it? (y/n)${NC}"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Deleting existing tag...${NC}"
        git tag -d "$tag_name"
        echo -e "${BLUE}Creating new tag: $tag_name...${NC}"
        git tag -a "$tag_name" -m "Release $tag_name"
        echo -e "${GREEN}Tag created.${NC}"
    else
        echo -e "${YELLOW}Would you like to specify a different tag name? (y/n)${NC}"
        read -r answer
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Enter a new tag name (without the 'v' prefix):${NC}"
            read -r new_version
            tag_name="v$new_version"
            echo -e "${BLUE}Creating tag: $tag_name...${NC}"
            git tag -a "$tag_name" -m "Release $tag_name"
            echo -e "${GREEN}Tag created.${NC}"
        else
            echo -e "${YELLOW}Skipping tag creation.${NC}"
        fi
    fi
else
    echo -e "${BLUE}Creating tag: $tag_name...${NC}"
    git tag -a "$tag_name" -m "Release $tag_name"
    echo -e "${GREEN}Tag created.${NC}"
fi

# Push to GitHub
echo -e "${YELLOW}Would you like to push the tag to GitHub now? (y/n)${NC}"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Pushing tag to GitHub...${NC}"
    git push origin "$tag_name"
    echo -e "${GREEN}Tag pushed to GitHub.${NC}"
    
    # Check if main branch exists
    if git show-ref --verify --quiet refs/heads/main; then
        branch="main"
    elif git show-ref --verify --quiet refs/heads/master; then
        branch="master"
    else
        branch=$(git symbolic-ref --short HEAD)
    fi
    
    echo -e "${YELLOW}Would you like to push the $branch branch to GitHub as well? (y/n)${NC}"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Pushing $branch branch to GitHub...${NC}"
        git push origin "$branch"
        echo -e "${GREEN}Branch pushed to GitHub.${NC}"
    fi
    
    # Get the repository URL
    repo_url=$(git config --get remote.origin.url)
    repo_url=${repo_url%.git}
    repo_url=${repo_url#*github.com[:/]}
    
    echo -e "${GREEN}Release process started!${NC}"
    echo -e "${BLUE}You can monitor the progress at:${NC}"
    echo -e "${YELLOW}https://github.com/$repo_url/actions${NC}"
    
    echo -e "${BLUE}Once the build is complete, you can find the release at:${NC}"
    echo -e "${YELLOW}https://github.com/$repo_url/releases${NC}"
    
    echo -e "${BLUE}The release will be created as a draft. You'll need to:${NC}"
    echo -e "${BLUE}1. Go to the releases page${NC}"
    echo -e "${BLUE}2. Edit the draft release${NC}"
    echo -e "${BLUE}3. Add release notes${NC}"
    echo -e "${BLUE}4. Upload the Windows artifacts from the dist directory${NC}"
    echo -e "${BLUE}5. Click 'Publish release'${NC}"
    
    echo -e "${YELLOW}Would you like to open the releases page now? (y/n)${NC}"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        if command -v open &> /dev/null; then
            open "https://github.com/$repo_url/releases"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "https://github.com/$repo_url/releases"
        elif command -v start &> /dev/null; then
            start "https://github.com/$repo_url/releases"
        else
            echo -e "${YELLOW}Please visit:${NC}"
            echo -e "${YELLOW}https://github.com/$repo_url/releases${NC}"
        fi
    fi
else
    echo -e "${YELLOW}You can push the tag later with:${NC}"
    echo -e "${BLUE}git push origin $tag_name${NC}"
fi

echo -e "${GREEN}Done!${NC}"