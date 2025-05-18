import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent


async def main():
    client = MultiServerMCPClient(
        {
            "sentio": {
                "url": "http://localhost:3000/sse",
                "transport": "sse",
            }
        }
    )

    # Get tools from the client
    tools = await client.get_tools()

    # Create a React agent with the specified model and tools
    agent = create_react_agent("openai:gpt-4.1", tools)

    # Invoke the agent with a math question
    price_response = await agent.ainvoke({"messages": "list all the coins and their price?"})

    # Print the responses
    print("Price Response:", price_response)

if __name__ == "__main__":
    asyncio.run(main())