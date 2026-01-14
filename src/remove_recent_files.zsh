#!/bin/zsh

# Find VS Code database (same logic as list_recent_projects.js)
db_path=""
for variant in \
    "${HOME}/Library/Application Support/Code/User/globalStorage/state.vscdb" \
    "${HOME}/Library/Application Support/Code - Insiders/User/globalStorage/state.vscdb" \
    "${HOME}/Library/Application Support/VSCodium/User/globalStorage/state.vscdb"
do
    if [[ -f "${variant}" ]]; then
        db_path="${variant}"
        break
    fi
done

# Exit if DB not found
if [[ -z "${db_path}" ]]; then
    echo "Error: VS Code database not found" >&2
    exit 1
fi

# Argument from Alfred (format: "remove:path" or "remove:all")
arg="${1}"

# Extract action from argument prefix
if [[ "${arg}" == "remove:all" ]]; then
    # Remove all entries
    /usr/bin/sqlite3 "${db_path}" \
        "UPDATE ItemTable SET value = '{\"entries\":[]}' WHERE key = 'history.recentlyOpenedPathsList';"
else
    # Remove single entry - extract path after "remove:" prefix
    path_to_remove="${arg#remove:}"
    /usr/bin/sqlite3 "${db_path}" <<EOF
UPDATE ItemTable
SET value = (
    SELECT JSON_OBJECT(
        'entries', JSON_GROUP_ARRAY(entry_json)
    )
    FROM (
        SELECT value AS entry_json
        FROM JSON_EACH(
            (SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'),
            '$.entries'
        )
        WHERE COALESCE(
            JSON_EXTRACT(value, '\$.folderUri'),
            JSON_EXTRACT(value, '\$.workspace.configPath'),
            JSON_EXTRACT(value, '\$.fileUri')
        ) != 'file://${path_to_remove}'
    )
)
WHERE key = 'history.recentlyOpenedPathsList';
EOF
fi

echo "Updated recent projects"
