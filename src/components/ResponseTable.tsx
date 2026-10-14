type ResponseTableProps = {
  texts: readonly string[];
};

export function ResponseTable({ texts }: ResponseTableProps) {
  if (texts.length === 0) {
    return (
      <div className="cloud-empty">
        <p>No responses yet.</p>
      </div>
    );
  }

  return (
    <div className="response-table-wrap">
      <table className="response-table">
        <caption>Shown in random order</caption>
        <thead>
          <tr>
            <th scope="col">Word</th>
          </tr>
        </thead>
        <tbody>
          {texts.map((text, index) => (
            <tr key={`${index}:${text}`}>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
