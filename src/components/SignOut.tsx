export default function SignOut() {
  return (
    <form action="/auth/signout" method="post">
      <button className="link-btn">Sign out</button>
    </form>
  );
}
