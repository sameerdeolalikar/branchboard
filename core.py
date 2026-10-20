"""Validated document model. Synthetic fixtures only."""
from datetime import date, timedelta
import re

def integer(value, low, high, label):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{label} must be an integer between {low} and {high}.")
    return value

def text(value, label, maximum=120):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must contain 1–{maximum} characters.")
    return value.strip()

def choice(value, allowed, label):
    if value not in allowed:
        raise ValueError(f"Invalid {label}.")
    return value

def items(raw, key):
    result=raw.get(key)
    if not isinstance(result,list) or len(result)>150:
        raise ValueError(f"{key} must be a list of at most 150 entries.")
    seen=set()
    for item in result:
        if not isinstance(item,dict): raise ValueError("Each entry must be an object.")
        key_id=item.get("id")
        if not isinstance(key_id,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,60}",key_id) or key_id in seen:
            raise ValueError("Entry identifiers must be unique and valid.")
        seen.add(key_id)
    return result

def base(raw):
    if not isinstance(raw,dict) or type(raw.get("version")) is not int or raw["version"]!=1:
        raise ValueError("Expected a version 1 document.")
    return {"version":1,"title":text(raw.get("title"),"Title")}
def validate(raw):
    out=base(raw);out["tasks"]=[]
    for x in items(raw,"tasks"):
        deps=x.get("depends",[])
        if not isinstance(deps,list) or any(not isinstance(v,str) for v in deps) or len(set(deps))!=len(deps):raise ValueError("Dependencies must be unique identifiers.")
        out["tasks"].append({"id":x["id"],"title":text(x.get("title"),"Task title"),"status":choice(x.get("status"),["backlog","active","done"],"status"),"priority":choice(x.get("priority"),["low","normal","high"],"priority"),"depends":deps,"note":text(x.get("note") or "—","Note",1000)})
    lookup={x["id"]:x for x in out["tasks"]};visiting=set();done=set()
    def visit(key):
        if key in visiting:raise ValueError("Dependency cycle detected.")
        if key in done:return
        visiting.add(key)
        for d in lookup[key]["depends"]:
            if d not in lookup:raise ValueError("A dependency refers to a missing task.")
            visit(d)
        visiting.remove(key);done.add(key)
    for key in lookup:visit(key)
    for task in out["tasks"]:
        if task["status"] in ["active","done"] and any(lookup[d]["status"]!="done" for d in task["depends"]):
            raise ValueError(f'{task["title"]} cannot be active or done while dependencies are unfinished.')
    return out

def analyze(doc):
    lookup={t["id"]:t for t in doc["tasks"]}
    blocked=[t["id"] for t in doc["tasks"] if any(lookup[d]["status"]!="done" for d in t["depends"])]
    return {"blocked":blocked,"metrics":{"Tasks":len(doc["tasks"]),"Blocked":len(blocked),"Active":sum(t["status"]=="active" for t in doc["tasks"]),"Done":sum(t["status"]=="done" for t in doc["tasks"])}}
