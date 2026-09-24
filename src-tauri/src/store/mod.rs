pub mod file;
pub mod writer;

use serde_json::Value;

// A migration upgrades raw JSON by exactly one schema version.
pub type Migration = fn(Value) -> Result<Value, String>;

// Upgrades raw JSON from `from` to `steps.len()` one step at a time.
pub fn migrate(value: Value, from: u32, steps: &[Migration]) -> Result<Value, String> {
    let from = from as usize;
    if from > steps.len() {
        return Err(format!(
            "file schema v{from} is newer than this app (v{}); update the app",
            steps.len()
        ));
    }
    steps[from..].iter().try_fold(value, |v, step| step(v))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn add_status(mut v: Value) -> Result<Value, String> {
        v["status"] = json!("planning");
        Ok(v)
    }

    fn rename_title(mut v: Value) -> Result<Value, String> {
        let title = v["name"].take();
        v["title"] = title;
        v.as_object_mut().unwrap().remove("name");
        Ok(v)
    }

    #[test]
    fn current_version_is_a_no_op() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let v = json!({ "title": "Dune", "status": "completed" });
        assert_eq!(migrate(v.clone(), 2, &steps).unwrap(), v);
    }

    #[test]
    fn applies_every_missing_step_in_order() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let out = migrate(json!({ "name": "Dune" }), 0, &steps).unwrap();
        assert_eq!(out, json!({ "title": "Dune", "status": "planning" }));
    }

    #[test]
    fn starts_from_the_stored_version() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let out = migrate(json!({ "name": "Dune", "status": "dropped" }), 1, &steps).unwrap();
        assert_eq!(out, json!({ "title": "Dune", "status": "dropped" }));
    }

    #[test]
    fn rejects_a_newer_version_than_the_app_knows() {
        let steps: [Migration; 1] = [add_status];
        let err = migrate(json!({}), 3, &steps).unwrap_err();
        assert!(err.contains("newer"), "{err}");
    }
}
