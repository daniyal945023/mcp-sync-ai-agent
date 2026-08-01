import asyncio
from graph import build_graph
from langchain_core.messages import HumanMessage

async def main():
    graph = await build_graph()
    print("User Interface - Enter your Message, use the following keyword to stop the conversation: exit")
    while True:
        user_input = input(">")
        if user_input.lower() == "exit":
            break
        llm_response = await graph.ainvoke({"messages": [HumanMessage(content=user_input)]})
        print(f"AI: {llm_response['messages'][-1].content}")


if __name__ == "__main__":
    asyncio.run(main())

