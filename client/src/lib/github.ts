// Bộ xử lý đẩy dữ liệu và nạp Feedback qua GitHub API (Không cần Database)
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || "";
const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || "";
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || "";

// Sửa dòng này:
const FILE_PATH = "client/src/data/website_data.json"; // hoặc "src/data/website_data.json" tùy theo repo của bạn

// 1. Hàm lưu dữ liệu từ Studio thẳng lên GitHub
export async function saveToGitHub(content: any): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.error("Thiếu biến môi trường GitHub trên Vercel!");
    return false;
  }

  try {
    // Lấy SHA của file cũ
    const getUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    let sha = "";
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // Ghi đè file mới (Push commit)
    const jsonString = JSON.stringify(content, null, 2);
    // Mã hóa UTF-8 sang Base64
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    const putRes = await fetch(getUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: "🐰 Cập nhật dữ liệu từ la Lapine Studio",
        content: base64Content,
        sha: sha || undefined,
      }),
    });

    return putRes.ok;
  } catch (error) {
    console.error("Lỗi khi push lên GitHub:", error);
    return false;
  }
}

// 2. Hàm gửi Feedback của khách (Tạo Issue công khai trên GitHub)
export async function postFeedbackToGitHub(charId: number, charName: string, author: string, content: string) {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return null;
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        title: `[Feedback] Gửi ${charName} (#${charId}) từ ${author}`,
        body: JSON.stringify({
          id: String(Date.now()),
          characterId: charId,
          authorName: author,
          content: content,
          createdAt: new Date().toISOString(),
        }),
        labels: ["guest-feedback"],
      }),
    });
    if (res.ok) {
      const issue = await res.json();
      return JSON.parse(issue.body);
    }
  } catch (err) {
    console.error("Lỗi gửi feedback:", err);
  }
  return null;
}

// 3. Hàm lấy toàn bộ Feedback công khai từ GitHub về hiển thị
export async function fetchFeedbacksFromGitHub(): Promise<any[]> {
  if (!GITHUB_OWNER || !GITHUB_REPO) return [];
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?labels=guest-feedback&state=all&per_page=100`;
    const res = await fetch(url, {
      headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {},
    });
    if (res.ok) {
      const issues = await res.json();
      const feedbacks: any[] = [];
      for (const issue of issues) {
        try {
          const parsed = JSON.parse(issue.body);
          if (parsed && parsed.characterId) feedbacks.push(parsed);
        } catch {}
      }
      return feedbacks;
    }
  } catch (err) {
    console.error("Lỗi lấy feedback từ GitHub:", err);
  }
  return [];
}
