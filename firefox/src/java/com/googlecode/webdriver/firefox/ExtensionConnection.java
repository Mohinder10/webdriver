package com.googlecode.webdriver.firefox;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.util.Enumeration;

class ExtensionConnection {
    private Socket socket;
    private final SocketAddress address;
    private PrintWriter out;
    private BufferedReader in;

    public ExtensionConnection(String host, int port) {
        InetAddress addr = null;

        if ("localhost".equals(host)) {
            addr = obtainLoopbackAddress();
        } else {
            try {
                addr = InetAddress.getByName(host);
            } catch (UnknownHostException e) {
                throw new RuntimeException(e);
            }
        }

        address = new InetSocketAddress(addr, port);
    }

    private InetAddress obtainLoopbackAddress() {
        InetAddress localIp4 = null;
        InetAddress localIp6 = null;

        try {
            Enumeration<NetworkInterface> allInterfaces = NetworkInterface.getNetworkInterfaces();
            while (allInterfaces.hasMoreElements()) {
                NetworkInterface iface = allInterfaces.nextElement();
                Enumeration<InetAddress> allAddresses = iface.getInetAddresses();
                while (allAddresses.hasMoreElements()) {
                    InetAddress addr = allAddresses.nextElement();
                    if (addr.isLoopbackAddress()) {
                        if (addr instanceof Inet4Address && localIp4 == null)
                            localIp4 = addr;
                        else if (addr instanceof Inet6Address&& localIp6 == null)
                            localIp6 = addr;
                    }
                }
            }
        } catch (SocketException e) {
            throw new RuntimeException(e);
        }

        // Firefox binds to the IP4 address by preference
        if (localIp4 != null)
            return localIp4;

        if (localIp6 != null)
            return localIp6;

        throw new RuntimeException("Unable to find loopback address for localhost");
    }

    public void connect() throws IOException {
        socket = new Socket();

        socket.connect(address);
        in = new BufferedReader(new InputStreamReader(socket.getInputStream(), "UTF-8"));
        out = new PrintWriter(socket.getOutputStream(), true);
    }

    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    public Response sendMessageAndWaitForResponse(String methodName, long driverId, String argument) {
        int lines = countLines(argument) + 1;

        StringBuffer message = new StringBuffer(methodName);
        message.append(" ").append(lines).append("\n");

        message.append(driverId).append("\n");

        if (argument != null)
            message.append(argument).append("\n");

        out.print(message.toString());
        out.flush();

        return waitForResponseFor(methodName);
    }

    private int countLines(String argument) {
        int lines = 0;

        if (argument != null)
            lines = argument.split("\n").length;
        return lines;
    }

    private Response waitForResponseFor(String command) {
        try {
            return readLoop(command);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private Response readLoop(String command) throws IOException {
        while (true) {
            Response response = nextResponse();

            if (command.equals(response.getCommand()))
                return response;
            throw new RuntimeException("Expected response to " + command + " but actually got: " + response.getCommand() + " (" + response.getCommand() + ")");
        }
    }

    private Response nextResponse() throws IOException {
        String line = in.readLine();

        // Expected input will be of the form:
        // CommandName NumberOfLinesRemaining
        // Identifier
        // ResponseText

        int spaceIndex = line.indexOf(' ');
        String methodName = line.substring(0, spaceIndex);
        String remainingResponse = line.substring(spaceIndex + 1);
        long count = Long.parseLong(remainingResponse);

        StringBuffer result = new StringBuffer();
        for (int i = 0; i < count; i++) {
            String read = in.readLine();
            result.append(read);
            if (i != count - 1)
                result.append("\n");
        }

        return new Response(methodName, result.toString());
    }
}