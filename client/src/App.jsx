import { UserContextProvider } from "./UserContext";
import axios from "axios";
import Routes from "./Routes";

const App = () => {
  axios.defaults.baseURL = "http://localhost:8000/";
  axios.defaults.withCredentials = true;
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
};

export default App;
