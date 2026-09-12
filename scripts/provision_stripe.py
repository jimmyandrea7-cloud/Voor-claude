import os, json, urllib.request

base = os.environ["INTEGRATION_PROXY_URL"]
job_id = "544e206f-2b17-4023-8527-7dd3b124c6ad"
key = "sk-emergent-4A81aC858C5F63c1aF"
req = urllib.request.Request(
    base + "/stripe/sandboxes",
    data=json.dumps({"job_id": job_id}).encode(),
    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    sandbox = json.load(r)
print(json.dumps(sandbox, indent=2))
