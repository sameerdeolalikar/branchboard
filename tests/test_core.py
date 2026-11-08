KEY='tasks'
import unittest, json, tempfile, copy
from pathlib import Path
from core import validate, analyze
from server import Store, Conflict
SAMPLE=json.loads((Path(__file__).resolve().parents[1]/"examples/sample.json").read_text())
class Tests(unittest.TestCase):
    def fresh(self):return copy.deepcopy(SAMPLE)
    def test_sample_roundtrip(self):
        doc=validate(self.fresh());self.assertEqual(doc,validate(json.loads(json.dumps(doc))));self.assertTrue(analyze(doc)["metrics"])
    def test_invalid_version(self):
        for version in [True,2,"1",None]:
            d=self.fresh();d["version"]=version
            with self.assertRaises(ValueError):validate(d)
    def test_duplicate_identity(self):
        d=self.fresh();d[KEY].append(copy.deepcopy(d[KEY][0]))
        with self.assertRaises(ValueError):validate(d)
    def test_empty_document(self):
        d=self.fresh();d[KEY]=[];self.assertEqual(validate(d)[KEY],[]);analyze(validate(d))
    def test_oversized_collection(self):
        d=self.fresh();d[KEY]=[dict(d[KEY][0],id="x"+str(i)) for i in range(151)]
        with self.assertRaises(ValueError):validate(d)
    def test_storage_revision_and_reopen(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"library.sqlite3";store=Store(path)
            first=store.save({"revision":0,"document":self.fresh()});second=store.save({**first,"document":dict(first["document"],title="Changed")})
            self.assertEqual(second["revision"],2)
            with self.assertRaises(Conflict):store.save(first)
            self.assertEqual(Store(path).get(first["id"])["document"]["title"],"Changed")
    def test_invalid_save_preserves_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=Store(Path(tmp)/"library.sqlite3");first=store.save({"revision":0,"document":self.fresh()})
            with self.assertRaises(ValueError):store.save({**first,"document":{"version":2}})
            self.assertEqual(store.get(first["id"]),first)
    def test_invalid_notes_preserve_saved_document_and_allow_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp) / "library.sqlite3")
            first = store.save({"revision": 0, "document": self.fresh()})
            for note in [None, False, True, 0, 1, [], ["note"], {}, {"text": "note"}]:
                with self.subTest(note=note):
                    draft = copy.deepcopy(first)
                    draft["document"]["tasks"][0]["note"] = note
                    with self.assertRaisesRegex(ValueError, "Note"):
                        store.save(draft)
                    self.assertEqual(store.get(first["id"]), first)
            draft = copy.deepcopy(first)
            draft["document"]["tasks"][0]["note"] = "Revised note"
            saved = store.save(draft)
            self.assertEqual(saved["revision"], 2)
            self.assertEqual(Store(store.path).get(first["id"]), saved)
            self.assertEqual(saved["document"]["tasks"][0]["note"], "Revised note")

    def test_optional_and_text_notes(self):
        for note in ["", "A note", "  Trimmed note  ", "n" * 1000]:
            with self.subTest(note=note):
                draft = self.fresh()
                draft["tasks"][0]["note"] = note
                self.assertEqual(validate(draft)["tasks"][0]["note"], note.strip() or "—")
        draft = self.fresh()
        del draft["tasks"][0]["note"]
        self.assertEqual(validate(draft)["tasks"][0]["note"], "—")
        for note in [" " * 3, "n" * 1001]:
            draft["tasks"][0]["note"] = note
            with self.assertRaisesRegex(ValueError, "Note"):
                validate(draft)
    def test_cycles_rejected(self):
        d=self.fresh();d["tasks"][0]["depends"]=["print"]
        with self.assertRaisesRegex(ValueError,"cycle"):validate(d)
    def test_missing_dependency_rejected(self):
        d=self.fresh();d["tasks"][0]["depends"]=["missing"]
        with self.assertRaisesRegex(ValueError,"missing"):validate(d)
    def test_blocked_transition_and_reopen_dependency(self):
        d=self.fresh();d["tasks"][3]["status"]="active"
        with self.assertRaisesRegex(ValueError,"unfinished"):validate(d)
        d=self.fresh();d["tasks"][0]["status"]="backlog"
        with self.assertRaises(ValueError):validate(d)
    def test_completion_unlocks_next_task(self):
        d=self.fresh();d["tasks"][1]["status"]="done";d["tasks"][2]["status"]="done";d["tasks"][3]["status"]="active"
        self.assertNotIn("print",analyze(validate(d))["blocked"])

if __name__=="__main__":unittest.main()
