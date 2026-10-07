import { Routes, Route } from "react-router-dom";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import TaskDetails from "./pages/TaskDetails";
import Leads from "./pages/Leads";
import LeadDetails from "./pages/LeadDetails";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<TaskDetails />} />
                    <Route path="leads" element={<Leads />} />
                    <Route path="leadDetails" element={<LeadDetails />} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="customerDetails" element={<CustomerDetails />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
