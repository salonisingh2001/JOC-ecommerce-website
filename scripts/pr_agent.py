import os
import requests
from datetime import datetime, timedelta, timezone

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO = os.getenv("REPO")

headers = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json"
}

owner, repo = REPO.split("/")
BASE_URL = f"https://api.github.com/repos/{owner}/{repo}"

def get_pulls():
    url = f"{BASE_URL}/pulls?state=all&per_page=100"
    return requests.get(url, headers=headers).json()

def main():
    pulls = get_pulls()
    now = datetime.now(timezone.utc)

    moved_last_24h = []
    abandoned_pr = []
    pr_last_7_days = {}

    for pr in pulls:
        updated_at = datetime.strptime(pr["updated_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        created_at = datetime.strptime(pr["created_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        author = pr["user"]["login"]

        if now - updated_at <= timedelta(hours=24):
            moved_last_24h.append(pr["title"])

        if pr["state"] == "open" and (now - updated_at).days > 14:
            abandoned_pr.append(pr["title"])

        if now - created_at <= timedelta(days=7):
            pr_last_7_days[author] = pr_last_7_days.get(author, 0) + 1

    print("\n📊 GitHub Daily Report\n")
    print(f"PRs moved last 24h: {len(moved_last_24h)}")
    print(f"Abandoned PRs (>14d): {len(abandoned_pr)}")

    print("\nPR Count by Author (7 days):")
    for author, count in pr_last_7_days.items():
        print(f"{author}: {count}")

if __name__ == "__main__":
    main()