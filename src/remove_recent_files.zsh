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

# Variables from Alfred
action="${action}"            # 0=remove single, 1=remove all (from mods.variables)
path_to_remove="${1}"         # Path del item a remover (from arg)

case "${action}" in
    0)  # Remove single entry - SQL directo
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
        WHERE JSON_EXTRACT(value, '$.folderUri') != 'file://${path_to_remove}'
          AND JSON_EXTRACT(value, '$.workspace.configPath') != 'file://${path_to_remove}'
          AND JSON_EXTRACT(value, '$.fileUri') != 'file://${path_to_remove}'
    )
)
WHERE key = 'history.recentlyOpenedPathsList';
EOF
        ;;
    1)  # Remove all - SQL super simple
        /usr/bin/sqlite3 "${db_path}" \
            "UPDATE ItemTable SET value = '{\"entries\":[]}' WHERE key = 'history.recentlyOpenedPathsList';"
        ;;
esac

echo "✓ Updated recent projects"
