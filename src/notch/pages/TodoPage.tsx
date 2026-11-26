import { formatDue } from "../../app/format";
import { useModel } from "../../app/model";
import { CheckIcon } from "../../ui/icons";
import { EmptyState } from "./EmptyState";

export function TodoPage() {
  const { snapshot, toggleTodo } = useModel();
  const items = snapshot.todo.slice(0, 4);
  const done = snapshot.todo.filter((item) => item.done).length;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing due"
        hint="Add a task and the notch will remind you."
      />
    );
  }

  return (
    <div className="page todo-page">
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id} className="todo-row" data-done={item.done ? "true" : undefined}>
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.title}
              className="todo-check"
              onClick={() => toggleTodo(item.id)}
            >
              {item.done ? <CheckIcon width={11} height={11} /> : null}
            </button>
            <span className="todo-title t-body">{item.title}</span>
            {item.dueAt !== null ? (
              <span className="todo-due t-meta tnum">{formatDue(item.dueAt)}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="t-meta todo-count">
        {done} of {snapshot.todo.length} done
      </p>
    </div>
  );
}
